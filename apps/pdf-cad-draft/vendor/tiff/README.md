TIFF decoder bundled from the repository's integrated-v0.13/vendor/tiff.
UTIF (Photopea, MIT), pako inflate (MIT/Zlib): accompanying license files retained.
Local UTIF change: both JPEG-in-TIFF decoder paths set the pinned JPEG decoder's
color-transform override (B=0) when TIFF PhotometricInterpretation is RGB (2).
This prevents RGB TIFF strips from incorrectly receiving a default YCbCr transform.
CCITT G3/G4, LZW, Deflate, PackBits, raw and JPEG-in-TIFF are exercised with Pillow
fixtures by tests/image-import.cjs. No external decoder/CDN requests are used.
