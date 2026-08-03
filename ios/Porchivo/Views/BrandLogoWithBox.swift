//
//  BrandLogoWithBox.swift
//  Porchivo
//
//  Reusable logo mark with the signature cardboard delivery box underlaid
//  behind it, used throughout the auth and splash surfaces.
//

import SwiftUI

struct BrandLogoWithBox: View {
    let logoSize: CGFloat
    var boxScale: CGFloat = 1.65
    var boxOffsetY: CGFloat? = nil

    var body: some View {
        let boxWidth = logoSize * boxScale
        let boxHeight = boxWidth * 0.874 // source image is 764x668
        let offsetY = boxOffsetY ?? logoSize * 0.06

        ZStack {
            Image("delivery_box_cardboard")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: boxWidth, height: boxHeight)
                .offset(y: (logoSize - boxHeight) / 2 + offsetY)
                .opacity(0.95)

            Image("LogoMark")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: logoSize, height: logoSize)
                .clipShape(.rect(cornerRadius: logoSize * 0.24))
                .shadow(color: .black.opacity(0.12), radius: 12, x: 0, y: 4)
        }
        .frame(width: boxWidth, height: boxHeight)
    }
}

#Preview {
    BrandLogoWithBox(logoSize: 80)
}
