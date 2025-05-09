#!/bin/bash

# Create a simple script to generate PWA icons using ImageMagick
# This requires imagemagick to be installed on the system

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null
then
    echo "ImageMagick is required but not installed. Please install it first."
    echo "On Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "On Arch Linux: sudo pacman -S imagemagick"
    echo "On macOS with Homebrew: brew install imagemagick"
    exit 1
fi

# Icon sizes needed for PWA
SIZES=(72 96 128 144 152 192 384 512)

# Generate a simple placeholder icon for each size
for size in "${SIZES[@]}"
do
    echo "Creating icon-${size}x${size}.png"
    convert -size ${size}x${size} canvas:#5c6bc0 \
        -fill white -gravity center -font Arial -pointsize $((size/4)) \
        -annotate 0 "SM" \
        -draw "fill #a389f4; circle $((size/2)),$((size/2)),$((size/2 - 10)),$((size/2))" \
        -draw "fill #5c6bc0; circle $((size/2)),$((size/2)),$((size/2 - 15)),$((size/2))" \
        -draw "fill white; circle $((size/2)),$((size/2)),$((size/2 - 20)),$((size/2))" \
        icon-${size}x${size}.png
done

echo "Icon generation complete! Icons created in the current directory."
echo "For production, please replace these with professional quality icons." 