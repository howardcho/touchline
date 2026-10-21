// Render the existing Touchline vector mark at App Store resolution, with an
// opaque square background. iPadOS applies the Home Screen corner mask itself.
import AppKit
let output = CommandLine.arguments[1]
let size = 1024
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                        bytesPerRow: size * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.setFillColor(CGColor(srgbRed: 24/255, green: 59/255, blue: 48/255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: size, height: size))
context.translateBy(x: 0, y: CGFloat(size)); context.scaleBy(x: 2, y: -2)
context.setStrokeColor(CGColor(srgbRed: 220/255, green: 244/255, blue: 141/255, alpha: 1))
context.setLineWidth(48); context.setLineCap(.round); context.setLineJoin(.round)
context.move(to: CGPoint(x: 145, y: 367)); context.addLine(to: CGPoint(x: 362, y: 150))
context.move(to: CGPoint(x: 155, y: 150)); context.addLine(to: CGPoint(x: 362, y: 150)); context.addLine(to: CGPoint(x: 362, y: 357))
context.strokePath()
let bitmap = NSBitmapImageRep(cgImage: context.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
