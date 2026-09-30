# Cards in the Wallet

The Wallet tab shows your cards as a stack, like Apple Wallet and Google Wallet. The Payvr card, which shows your balance, sits on top, and connected cards peek out underneath. Tap a card to bring it to the front.

With the Payvr card in front, you get:
- Add money, Cash out, Send and Request.
- This month's in/out and your daily limit.
- Your recent activity.

With a connected card in front, you get:
- **Pay a friend with this card**, which starts a tap payment with the card.
- A **Default for payments** switch.
- The card's details (network, last 4, expiry, issuer).
- **Remove card**, which asks for Face ID or your PIN.

The **+** button adds a card.

## Paying with a card

On the send screen, **Pay with** shows your balance and each connected card, and you can switch on every payment. If the amount is more than your balance, a card is chosen for you.

Paying with a card does two things after a single Face ID/PIN check:
1. It charges the card for the amount (`addMoney` in `services/payments.ts`, test mode).
2. It sends the money over Payvr as usual.

The receipt shows "Paid with Visa •• 4242". All money still moves only through `services/payments.ts`.

## What's stored

Only display details are kept on the phone (`payvr.cards`): brand, last 4 digits, expiry and issuer name. There is never a full card number or security code. The store drops any other field, both when it saves and when it loads.

In test mode you pick one of Stripe's public test cards (4242, 4444, 0005, 1117), which can't move real money.

## Before real cards

- **Real cards:** add them with a Stripe SetupIntent.
  - The card is typed into Stripe's own secure sheet, so Payvr's servers keep a Stripe payment-method id, never the number.
  - Store cards server-side per user (with RLS) instead of on the phone.
  - Charge the saved payment method in the `stripe-topup` Edge Function.

## Paying at store registers (tap to pay in shops): not possible yet

Paying at a store terminal with the phone needs contactless card emulation. That isn't something an app can switch on:
- **Be an issuer.** Payvr would have to issue its own cards through a bank or issuing partner (for example Stripe Issuing, Marqeta or Lithic), or partner with issuers. It must also use network tokenization (Visa Token Service, Mastercard MDES). Copying a card someone already has onto the phone is card cloning, and networks block it.
- **iPhone:** contactless payments from a third-party app need Apple's NFC & SE Platform entitlement. Apple grants it only to approved payment providers, in supported countries, under a commercial agreement. Otherwise, the issuer adds the card to Apple Pay through Apple's in-app provisioning.
- **Android:** Host Card Emulation is possible, but only with tokenized cards from the issuer and a certified EMV payment kernel.

The realistic path is to issue a Payvr debit card (for example with Stripe Issuing) and offer "Add to Apple Wallet / Google Wallet" through the issuer's push provisioning. Store tap-to-pay would then happen through Apple Pay and Google Pay.
