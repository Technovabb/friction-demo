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
   | `settings` | Website name, Barbados time zone, 4 looks per row with whole photos (no crop), share image, `robots.txt` set to keep the site out of search engines, Variants switched on. Turns on Odoo's "Hide Add To Cart" for $0 products, so nothing can reach the cart or a checkout. |
   | `theme` | Friction red, near-black and off-white; Anton headings, Inter text; black header and footer. `FRB.run('theme', {reset:true})` undoes it. |
   | `categories` | New Arrivals, Graphic Tees, Sets, Denim Looks, Footwear. |
   | `ribbons` | Just Landed, New Arrival, The Edit. |
   | `products` | The 16 looks: photo, name, short note, description of what the photo shows, categories, badge, price 0. No size attribute, so Odoo never preselects a size. |
   | `delivery` | One $0 method, "Collection or delivery: to be confirmed"; other methods unpublished. |
   | `checkout` | Checkout steps renamed: Enquiry bag, Your details, Send enquiry. Only matters if a checkout is switched back on later. |
   | `email` | Rewords Odoo's order confirmation email as an enquiry receipt with no amounts. `FRB.run('resetEmail')` (or Odoo's Reset Template) puts the original back. |
   | `options` | Hides Buy now, the header Contact Us button, wishlist, compare, the quantity picker, Sign in and "Powered by Odoo"; shows category pills on the shop. |
   | `views` | The QWeb inherits in `odoo/views/`: Styled Look labels, size enquiry, Check Price & Availability, Enquiry Bag header link, one H1 per shop page, customer care links. `FRB.run('removeViews')` archives them all. |
   | `pages` | Home, Our Story, Visit Us, Enquiry Bag (`/enquiry-bag`), plus unpublished Delivery & Collection, Returns & Refunds, Privacy Policy, Terms & Conditions and Contact pages that say only "Contact Friction for details." |
   | `menus` | Shop dropdown (All Looks, New Arrivals, Graphic Tees, Sets, Denim Looks, Footwear), New Arrivals, Graphic Tees, Sets, Our Story, Visit Us. |
   | `seo` | Shop page title and description; unpublishes Odoo's sample /contactus and /privacy pages. |
   | `customCode` | Brand CSS, the WhatsApp links (look name plus optional size), the Enquiry Bag (kept in the visitor's browser) and the footer. |
   | `placeholders` | Swaps Odoo's placeholder phone number in the header for (246) 622-1748. |
   | `verify` | Read-only checks: 16 published looks, no prices, no SKUs, and every public page has one H1, a description, noindex, no internal notes, no sign-in and no cart. |

Every step can be run again safely. Records are tagged `friction_demo.*` (external ids) and views `website.friction_*`.

## Before launch

- Swap the text wordmark for Friction's official logo file.
- Write and publish the customer care pages; the footer shows each link once its page is published.
- Replace "Price on request" with real prices once Friction approves them; turning off "Hide Add To Cart" brings the cart and checkout back.
- Remove the robots `noindex` (custom head code and `robots.txt`) only when Friction approves the public launch.
