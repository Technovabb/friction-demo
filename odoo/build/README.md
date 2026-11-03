# Run order

1. Sign in to the Odoo database in a browser tab and open any back-office page (e.g. `/odoo`).
2. Open the browser console on that tab and load the kit:

   ```js
   await fetch('https://technovabb.com/friction-demo/odoo/build/friction-build.js?v=' + Date.now()).then(r => r.text()).then(eval)
   ```

3. Run every step: `await FRB.all()`, or one at a time with `await FRB.run('<step>')`:

   | Step | What it does |
   |---|---|
   | `introspect` | Finds the website, Odoo version and field names. Always first. |
   | `settings` | Website name, Barbados time zone, 4 looks per row with whole photos (no crop), share image, `robots.txt` set to keep the demo out of search engines, Variants switched on. |
   | `theme` | Friction red, near-black and off-white; Anton headings, Inter text; black header and footer. `FRB.run('theme', {reset:true})` undoes it. |
   | `categories` | New Arrivals, Graphic Tees, Sets, Denim Looks, Footwear. |
   | `ribbons` | Just Landed, New Arrival, The Edit. |
   | `sizeAttr` | "Size (availability to confirm)" with S, M, L, XL, 2XL as pills. No variants, no stock. |
   | `products` | The 16 looks: photo, working name, short note, description of what the photo shows, categories, badge, price 0. |
   | `delivery` | One $0 method, "Collection or delivery: to be confirmed"; other methods unpublished. |
   | `checkout` | Checkout steps renamed: Enquiry bag, Your details, Send enquiry. The last button reads "Send enquiry" (the company's free-order label). |
   | `email` | Rewords Odoo's order confirmation email as an enquiry receipt with no amounts. `FRB.run('resetEmail')` (or Odoo's Reset Template) puts the original back. |
   | `options` | Hides Buy now and the header Contact Us button, shows category pills on the shop. |
   | `views` | The QWeb inherits in `odoo/views/`. `FRB.run('removeViews')` archives them all. |
   | `pages` | Home, Our Story (`/our-story`), Visit Us (`/visit-us`), with page titles and descriptions. |
   | `menus` | Shop, New Arrivals, Graphic Tees, Sets, Our Story, Visit Us. |
   | `customCode` | Brand CSS, the concept-demo bar, WhatsApp helpers and the footer. |
   | `placeholders` | Swaps Odoo's placeholder phone number in the header for (246) 622-1748. |
   | `verify` | Read-only checks: 16 published looks, no prices, no SKUs, pages and photos load. |

Every step can be run again safely. Records are tagged `friction_demo.*` (external ids) and views `website.friction_*`.

## Before launch

Remove the concept-demo bar and client notes, swap the text wordmark for Friction's official logo file, and replace "Price on request" with real prices once Friction approves them.
