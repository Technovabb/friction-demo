# Friction Clothing Barbados on Odoo: demo build kit

A client demo of a Friction Clothing Barbados website on Odoo Website and eCommerce: home, shop, product pages, an enquiry bag, Our Story and Visit Us. Made by Tech Nova.

This repo holds only the build kit. The demo itself runs in an Odoo Online database.

| Path | What it is |
|---|---|
| `odoo/catalogue.json` | 16 looks from Friction's own product photos, with working names, categories and badges. No prices, SKUs, stock or sizes: Friction has not supplied them yet, so the site shows "Price on request". |
| `odoo/images/` | Friction's product photos, re-encoded for the web, plus a share image. |
| `odoo/pages/` | Home, Our Story and Visit Us page content (Odoo QWeb) and `pages.json`. |
| `odoo/views/` | Small QWeb inherits: Price on request, Add to enquiry bag, the WhatsApp button and info panels, the text wordmark and the enquiry wording. |
| `odoo/theme/` | Brand styles (Anton + Inter, both SIL Open Font License), the concept-demo bar, the footer and the WhatsApp helpers. |
| `odoo/build/` | `friction-build.js` (runs in a logged-in Odoo tab) and `README.md` (run order). |

Files are served from https://technovabb.com/friction-demo/odoo/ so the Odoo tab can fetch them.

Photos and brand names belong to Friction Clothing Barbados. The look names are working titles for the demo.
