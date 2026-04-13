import qrcode
import json
import os
from PIL import Image, ImageDraw, ImageFont

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
# This secret must EXACTLY match the LIBRARY_QR_SECRET in your backend .env
# Change this to something long and random before printing QR codes for production
SECRET_KEY = "AxuTh_L1b_Qr_X9mK_2pZ_vN7wRjT4sY"

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# -------------------------------------------------------------------
# QR DATA — Only action + secret. The app handles the API URL itself.
# -------------------------------------------------------------------
ENTRY_PAYLOAD = json.dumps({
    "feature": "LIBRARY",
    "action": "ENTRY",
    "secret": SECRET_KEY
})

EXIT_PAYLOAD = json.dumps({
    "feature": "LIBRARY",
    "action": "EXIT",
    "secret": SECRET_KEY
})


def generate_qr(data: str, label: str, color: str, output_filename: str):
    """
    Generates a styled QR code image with a label below it.

    Args:
        data: The JSON string to encode inside the QR code.
        label: The text to display below the QR (e.g. "LIBRARY ENTRY").
        color: The foreground color of the QR dots.
        output_filename: The filename to save the image as (inside /output).
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --- Generate the raw QR code ---
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # Survives minor physical damage on print
        box_size=12,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    qr_image = qr.make_image(fill_color=color, back_color="white").convert("RGB")

    # --- Add a label below the QR ---
    qr_width, qr_height = qr_image.size
    label_area_height = 80
    total_height = qr_height + label_area_height

    canvas = Image.new("RGB", (qr_width, total_height), "white")
    canvas.paste(qr_image, (0, 0))

    draw = ImageDraw.Draw(canvas)

    # Try to use a bold font, fall back to default if not available on the OS
    try:
        font = ImageFont.truetype("arialbd.ttf", 28)
    except IOError:
        font = ImageFont.load_default()

    # Center the label text
    bbox = draw.textbbox((0, 0), label, font=font)
    text_width = bbox[2] - bbox[0]
    x = (qr_width - text_width) // 2
    y = qr_height + 20

    draw.text((x, y), label, fill=color, font=font)

    # --- Save ---
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    canvas.save(output_path)
    print(f"  Saved: {output_path}")


def main():
    print("\n Generating Library QR Codes...\n")

    generate_qr(
        data=ENTRY_PAYLOAD,
        label="  LIBRARY ENTRY",
        color="#1a7a1a",
        output_filename="library_entry_qr.png"
    )

    generate_qr(
        data=EXIT_PAYLOAD,
        label="  LIBRARY EXIT",
        color="#a31515",
        output_filename="library_exit_qr.png"
    )

    print(f"\n Done! Check the 'output/' folder for your QR images.")
    print(" Print them: stick ENTRY on the left, EXIT on the right of the library gate.\n")


if __name__ == "__main__":
    main()
