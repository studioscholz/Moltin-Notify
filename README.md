# 📬 Moltin Notify

e-Mail notifications (vendor and customer) and stock management for completed Moltin orders

## Installation

1. Clone this repository or download a copy to your local environment
2. Add a .env file to the root folder:
```
MOLTIN_CLIENT_ID=
MOLTIN_CLIENT_SECRET=

NODEMAILER_PROVIDER=
NODEMAILER_EMAIL=
NODEMAILER_PASSWORD=

SENDER_EMAIL=
VENDOR_EMAIL=

CURRENCY_SYMBOL=
CURRENCY_POSITION=
TAX_AMOUNT=
```

|Variable|Description|Type|
|:---|---|---|
|`MOLTIN_CLIENT_ID`|Moltin Client ID|String|
|`MOLTIN_CLIENT_SECRET`|Moltin Client Secret|String|
|`NODEMAILER_PROVIDER`|[Supported providers](https://nodemailer.com/smtp/well-known/)|String|
|`NODEMAILER_EMAIL`|Provider e-mail|String|
|`NODEMAILER_PASSWORD`|Provider password|String|
|`SENDER_EMAIL`|e-Mail address to send e-mails from|String|
|`VENDOR_EMAIL`|e-Mail address to receive vendor e-mails|String|
|`CURRENCY_SYMBOL`|Currency symbol, eg. `€`|String|
|`CURRENCY_POSITION`|`before` or `after`|String|
|`TAX_AMOUNT`|tax percentage as float, eg. `0.2`|Float|

3. Create Moltin webhook
```
curl -X POST https://api.moltin.com/v2/integrations \
     -H "Authorization: Bearer: XXXX" \
     -H "Content-Type: application/json" \
     -d $'{
      "data": {
        "type": "integration",
        "name": "order confirmed",
        "description": "order confirmed notification",
        "enabled": true,
        "observes": [
          "order.paid"
        ],
        "integration_type": "webhook",
        "configuration": {
          "url": "XXXX"
        }
      }
    }'
 ```

## Dependencies

- [niftylettuce/email-templates](https://github.com/niftylettuce/email-templates)
- [pugjs/pug](https://github.com/pugjs/pug)

## Usage
Run the app with `npm run start`


