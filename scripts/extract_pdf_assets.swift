import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import AppKit

let pdfPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "./PAYAM MICE SUNUM.pdf"
let outDir = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "./scratch_raw_img"

try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let url = URL(fileURLWithPath: pdfPath)
guard let doc = CGPDFDocument(url as CFURL) else {
    fputs("Failed to open PDF\n", stderr)
    exit(1)
}

func getColorSpace(_ dict: CGPDFDictionaryRef) -> (CGColorSpace, Int) {
    var csObj: CGPDFObjectRef?
    guard CGPDFDictionaryGetObject(dict, "ColorSpace", &csObj), let obj = csObj else {
        return (CGColorSpaceCreateDeviceRGB(), 3)
    }
    var namePtr: UnsafePointer<Int8>?
    if CGPDFObjectGetValue(obj, .name, &namePtr), let n = namePtr {
        let name = String(cString: n)
        if name == "DeviceGray" { return (CGColorSpaceCreateDeviceGray(), 1) }
        if name == "DeviceCMYK" { return (CGColorSpaceCreateDeviceCMYK(), 4) }
        return (CGColorSpaceCreateDeviceRGB(), 3)
    }
    var arr: CGPDFArrayRef?
    if CGPDFObjectGetValue(obj, .array, &arr), let a = arr {
        var firstName: UnsafePointer<Int8>?
        if CGPDFArrayGetName(a, 0, &firstName), let fn = firstName {
            let csType = String(cString: fn)
            if csType == "ICCBased" {
                var iccStream: CGPDFStreamRef?
                if CGPDFArrayGetStream(a, 1, &iccStream), let s = iccStream, let sdict = CGPDFStreamGetDictionary(s) {
                    var nComp: CGPDFInteger = 3
                    CGPDFDictionaryGetInteger(sdict, "N", &nComp)
                    var fmt = CGPDFDataFormat.raw
                    if let iccData = CGPDFStreamCopyData(s, &fmt) as Data? {
                        if let cs = CGColorSpace(iccData: iccData as CFData) {
                            return (cs, Int(nComp))
                        }
                    }
                    if nComp == 1 { return (CGColorSpaceCreateDeviceGray(), 1) }
                    if nComp == 4 { return (CGColorSpaceCreateDeviceCMYK(), 4) }
                }
            } else if csType == "CalRGB" {
                return (CGColorSpaceCreateDeviceRGB(), 3)
            } else if csType == "CalGray" {
                return (CGColorSpaceCreateDeviceGray(), 1)
            } else if csType == "Indexed" {
                // Fallback handling
                return (CGColorSpaceCreateDeviceRGB(), 3)
            }
        }
    }
    return (CGColorSpaceCreateDeviceRGB(), 3)
}

func buildCGImage(from stream: CGPDFStreamRef) -> CGImage? {
    guard let sdict = CGPDFStreamGetDictionary(stream) else { return nil }
    var w: CGPDFInteger = 0
    var h: CGPDFInteger = 0
    var bpc: CGPDFInteger = 8
    CGPDFDictionaryGetInteger(sdict, "Width", &w)
    CGPDFDictionaryGetInteger(sdict, "Height", &h)
    CGPDFDictionaryGetInteger(sdict, "BitsPerComponent", &bpc)
    if w <= 0 || h <= 0 { return nil }

    var fmt = CGPDFDataFormat.raw
    guard let cfData = CGPDFStreamCopyData(stream, &fmt) else { return nil }
    let data = cfData as Data

    var baseImage: CGImage?
    if fmt == .jpegEncoded || fmt == .JPEG2000 {
        if let src = CGImageSourceCreateWithData(data as CFData, nil) {
            baseImage = CGImageSourceCreateImageAtIndex(src, 0, nil)
        }
    } else {
        let (cs, comps) = getColorSpace(sdict)
        let bytesPerRow = (Int(w) * comps * Int(bpc) + 7) / 8
        let expectedLen = bytesPerRow * Int(h)
        if data.count < expectedLen {
            fputs("Warning: data count \(data.count) < expected \(expectedLen) for \(w)x\(h) comps=\(comps)\n", stderr)
        }
        guard let provider = CGDataProvider(data: data as CFData) else { return nil }
        var decodeArray: [CGFloat]? = nil
        var decodePdf: CGPDFArrayRef?
        if CGPDFDictionaryGetArray(sdict, "Decode", &decodePdf), let darr = decodePdf {
            let cnt = CGPDFArrayGetCount(darr)
            var vals: [CGFloat] = []
            for idx in 0..<cnt {
                var num: CGPDFReal = 0
                if CGPDFArrayGetNumber(darr, idx, &num) {
                    vals.append(CGFloat(num))
                }
            }
            if !vals.isEmpty { decodeArray = vals }
        }
        if let d = decodeArray {
            baseImage = d.withUnsafeBufferPointer { buf in
                CGImage(
                    width: Int(w),
                    height: Int(h),
                    bitsPerComponent: Int(bpc),
                    bitsPerPixel: comps * Int(bpc),
                    bytesPerRow: bytesPerRow,
                    space: cs,
                    bitmapInfo: CGBitmapInfo(rawValue: 0),
                    provider: provider,
                    decode: buf.baseAddress,
                    shouldInterpolate: true,
                    intent: .defaultIntent
                )
            }
        } else {
            baseImage = CGImage(
                width: Int(w),
                height: Int(h),
                bitsPerComponent: Int(bpc),
                bitsPerPixel: comps * Int(bpc),
                bytesPerRow: bytesPerRow,
                space: cs,
                bitmapInfo: CGBitmapInfo(rawValue: 0),
                provider: provider,
                decode: nil,
                shouldInterpolate: true,
                intent: .defaultIntent
            )
        }
    }

    guard let img = baseImage else { return nil }

    // Check for SMask
    var smaskStream: CGPDFStreamRef?
    if CGPDFDictionaryGetStream(sdict, "SMask", &smaskStream), let sm = smaskStream,
       let smDict = CGPDFStreamGetDictionary(sm) {
        var sw: CGPDFInteger = 0, sh: CGPDFInteger = 0, sbpc: CGPDFInteger = 8
        CGPDFDictionaryGetInteger(smDict, "Width", &sw)
        CGPDFDictionaryGetInteger(smDict, "Height", &sh)
        CGPDFDictionaryGetInteger(smDict, "BitsPerComponent", &sbpc)
        var sfmt = CGPDFDataFormat.raw
        if let sData = CGPDFStreamCopyData(sm, &sfmt) as Data?, sw > 0 && sh > 0 {
            let sBytesPerRow = (Int(sw) * Int(sbpc) + 7) / 8
            if let sProvider = CGDataProvider(data: sData as CFData),
               let maskImg = CGImage(
                maskWidth: Int(sw),
                height: Int(sh),
                bitsPerComponent: Int(sbpc),
                bitsPerPixel: Int(sbpc),
                bytesPerRow: sBytesPerRow,
                provider: sProvider,
                decode: [1, 0], // Wait: let's render into RGBA bitmap context using alpha!
                shouldInterpolate: true
               ) {
                // Better approach: draw base image and apply SMask via CGContext.clip(to:mask:) using grayscale mask!
                _ = maskImg
            }
            // Reliable alpha compositing using RGBA context + raw grayscale mask buffer
            let srgb = CGColorSpaceCreateDeviceRGB()
            let ctx = CGContext(
                data: nil,
                width: Int(w),
                height: Int(h),
                bitsPerComponent: 8,
                bytesPerRow: Int(w) * 4,
                space: srgb,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
            if let ctx = ctx {
                ctx.draw(img, in: CGRect(x: 0, y: 0, width: Int(w), height: Int(h)))
                if let ptr = ctx.data {
                    let pixels = ptr.assumingMemoryBound(to: UInt8.self)
                    let total = Int(w) * Int(h)
                    let mTotal = min(total, sData.count)
                    for idx in 0..<mTotal {
                        let a = sData[idx]
                        let off = idx * 4
                        // Unpremultiply or re-premultiply (RGB drawn at alpha=255 so RGB values are intact!)
                        let af = Float(a) / 255.0
                        pixels[off] = UInt8(min(255, Float(pixels[off]) * af))
                        pixels[off+1] = UInt8(min(255, Float(pixels[off+1]) * af))
                        pixels[off+2] = UInt8(min(255, Float(pixels[off+2]) * af))
                        pixels[off+3] = a
                    }
                    if let composed = ctx.makeImage() {
                        return composed
                    }
                }
            }
        }
    }

    // Convert non-RGB (like CMYK) to sRGB via CGContext so PNG/JPEG viewers render accurately
    if img.colorSpace?.model != .rgb {
        let srgb = CGColorSpaceCreateDeviceRGB()
        if let ctx = CGContext(
            data: nil,
            width: img.width,
            height: img.height,
            bitsPerComponent: 8,
            bytesPerRow: img.width * 4,
            space: srgb,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) {
            ctx.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
            if let converted = ctx.makeImage() {
                return converted
            }
        }
    }

    return img
}

func savePNG(_ image: CGImage, to path: String) {
    let url = URL(fileURLWithPath: path)
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fputs("Failed to create PNG dest for \(path)\n", stderr)
        return
    }
    CGImageDestinationAddImage(dest, image, nil)
    CGImageDestinationFinalize(dest)
}

func scanDict(_ dict: CGPDFDictionaryRef, prefix: String) {
    var resDict: CGPDFDictionaryRef?
    guard CGPDFDictionaryGetDictionary(dict, "Resources", &resDict), let res = resDict else { return }
    var xobjDict: CGPDFDictionaryRef?
    guard CGPDFDictionaryGetDictionary(res, "XObject", &xobjDict), let xobj = xobjDict else { return }

    let ptr = UnsafeMutablePointer<(String, [(String, CGPDFStreamRef)], [(String, CGPDFDictionaryRef)])>.allocate(capacity: 1)
    ptr.initialize(to: (prefix, [], []))

    CGPDFDictionaryApplyFunction(xobj, { (key, value, info) in
        let name = String(cString: key)
        let box = info!.assumingMemoryBound(to: (String, [(String, CGPDFStreamRef)], [(String, CGPDFDictionaryRef)]).self)
        var stream: CGPDFStreamRef?
        if CGPDFObjectGetValue(value, .stream, &stream), let s = stream, let sdict = CGPDFStreamGetDictionary(s) {
            var subtype: UnsafePointer<Int8>?
            CGPDFDictionaryGetName(sdict, "Subtype", &subtype)
            let st = subtype.map { String(cString: $0) } ?? ""
            if st == "Image" {
                box.pointee.1.append(("\(box.pointee.0)_\(name)", s))
            } else if st == "Form" {
                box.pointee.2.append(("\(box.pointee.0)_\(name)", sdict))
            }
        }
    }, ptr)

    let (_, images, forms) = ptr.pointee
    ptr.deallocate()

    for (imgId, stream) in images {
        if let cg = buildCGImage(from: stream) {
            let outPath = "\(outDir)/\(imgId).png"
            savePNG(cg, to: outPath)
            print("Saved \(imgId).png (\(cg.width)x\(cg.height))")
        } else {
            fputs("FAILED to decode \(imgId)\n", stderr)
        }
    }

    for (formId, fdict) in forms {
        scanDict(fdict, prefix: formId)
    }
}

for pageNum in 1...doc.numberOfPages {
    guard let page = doc.page(at: pageNum), let dict = page.dictionary else { continue }
    scanDict(dict, prefix: "P\(pageNum)")
}
print("Done extracting PDF images.")
