const express = require('express')
const app = express()
const moltinGateway = require('@moltin/sdk').gateway
const bodyParser = require('body-parser')
const dotenv = require('dotenv').config()
const Email = require('email-templates')
const nodemailer = require('nodemailer')
const path = require('path')
const juice = require('juice')
const port = process.env.PORT || 3001

const Moltin = moltinGateway({
  client_id: process.env.MOLTIN_CLIENT_ID,
  client_secret: process.env.MOLTIN_CLIENT_SECRET
})

const transporter = nodemailer.createTransport({
  service: process.env.NODEMAILER_PROVIDER,
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
})

const countries = require('./countries.js')

// Decrease stock in Moltin
function manageStock(moltinItems) {
  const inventoryItems = moltinItems.filter(item => item.product_id.length > 0)

  for (i = 0; i < inventoryItems.length; i++) {
    const item = inventoryItems[i]
    const productID = item.product_id
    const quantity = item.quantity

    Moltin.Inventories.DecrementStock(productID, quantity).then((response) => {
      console.log(
        `Stock for ${item.name} (${item.product_id}) decremented by ${quantity}`
      )
    }).catch((error) => {
      console.error(error)
    })
  }
}

// Helpers
function extractDate(isoString) {
  const input = isoString.split("T")[0].split("-")
  const day = input[2]
  const month = input[1]
  const year = input[0]
  let monthNames = 'January,February,March,April,May,June,July,August,September,October,November,December'
  monthNames = monthNames.split(',')

  return monthNames[Number(month) - 1] + ' ' + day + ', ' + year
}

function isEquivalent(a, b) {
  delete b['phone_number']
  delete b['instructions']
  const aProps = Object.getOwnPropertyNames(a)
  const bProps = Object.getOwnPropertyNames(b)

  if (aProps.length != bProps.length) {
    return false
  }

  for (let i = 0; i < aProps.length; i++) {
    const propName = aProps[i]
    if (a[propName] !== b[propName]) {
        return false
    }
  }

  return true
}

function findCountry (code) {
  const match = countries.find(country => country.code === code)
  return match.name
}

// Send notifications
function sendMail(moltinResources, req) {

  // General
  const moltinCustomer = moltinResources.data.customer
  const moltinDate = extractDate(moltinResources.data.meta.timestamps.created_at)

  // Addresses
  const moltinShippingAddress = moltinResources.data.shipping_address
  const moltinBillingAddress = moltinResources.data.billing_address

  // Products
  const moltinItems = moltinResources.included.items
  const moltinProducts = moltinItems.filter(item => item.product_id.length > 0)
  const moltinShipping = moltinItems.find(item => item.sku === "shipping")
  const shippingSet = moltinShipping != null && Object.keys(moltinShipping).length > 0 && moltinShipping.constructor === Object
  
  // Costs
  const moltinShippingCost = shippingSet ? moltinShipping.meta.display_price.with_tax.unit.formatted : null
  const moltinTotal = moltinResources.data.meta.display_price.with_tax.formatted
  
  let amount = moltinResources.data.meta.display_price.with_tax.amount
  amount = shippingSet ? (amount - moltinShipping.value.amount) / 100 : amount / 100
  amount = amount.toFixed(2)

  let moltinAmount = process.env.CURRENCY_POSITION === 'start' ? process.env.CURRENCY_SYMBOL + ' ' : ''
  moltinAmount += amount
  moltinAmount += process.env.CURRENCY_POSITION === 'start' '' : ' ' + process.env.CURRENCY_SYMBOL

  let taxCalc = moltinResources.data.meta.display_price.with_tax.amount / 100 * parseFloat(process.env.TAX_AMOUNT)
  taxCalc = taxCalc.toFixed(2)

  let moltinTax = process.env.CURRENCY_POSITION === 'start' ? process.env.CURRENCY_SYMBOL + ' ' : ''
  moltinTax += taxCalc
  moltinTax += process.env.CURRENCY_POSITION === 'start' '' : ' ' + process.env.CURRENCY_SYMBOL

  // URL for CSS File 
  const appUrl = req.protocol + '://' + req.get('host') + req.originalUrl

  // Construct e-Mail
  const email = new Email({
    message: {
      from: process.env.SENDER_EMAIL
    },
    send: true,
    transport: transporter,
    juice: true,
    juiceResources: {
      preserveImportant: true,
      webResources: {
        relativeTo: appUrl
      }
    }
  })

  // Send customer e-Mail
  email.send({
    template: 'customer',
    message: {
      to: moltinCustomer.email
    },
    locals: {
      order_id: moltinResources.data.id,
      date: moltinDate,
      name: moltinCustomer.name,
      shipping_address: {
        first_name: moltinShippingAddress.first_name,
        last_name: moltinShippingAddress.last_name,
        line_1: moltinShippingAddress.line_1,
        line_2: moltinShippingAddress.line_2,
        city: moltinShippingAddress.city,
        postcode: moltinShippingAddress.postcode,
        country: findCountry(moltinShippingAddress.country),
      },
      billing_address: {
        first_name: moltinBillingAddress.first_name,
        last_name: moltinBillingAddress.last_name,
        line_1: moltinBillingAddress.line_1,
        line_2: moltinBillingAddress.line_2,
        city: moltinBillingAddress.city,
        postcode: moltinBillingAddress.postcode,
        country: findCountry(moltinBillingAddress.country),
      },
      address_comparison: isEquivalent(moltinBillingAddress, moltinShippingAddress),
      products: moltinProducts,
      amount: moltinAmount,
      total: moltinTotal,
      tax: moltinTax,
      shipping: moltinShipping,
      shipping_set: shippingSet,
      shipping_cost: moltinShippingCost,
      currency: process.env.CURRENCY_SYMBOL,
      tax_percentage: parseFloat(process.env.TAX_AMOUNT) * 100
    }
  })
  .then((response) => {
    console.log(
      'The customer notification has been sent'
    )
  }).catch((error) => {
    console.error(error)
  })

  // Send vendor e-mail
  email.send({
    template: 'vendor',
    message: {
      to: process.env.VENDOR_EMAIL
    },
    locals: {
      order_id: moltinResources.data.id,
      date: moltinDate,
      name: moltinCustomer.name,
      shipping_address: {
        first_name: moltinShippingAddress.first_name,
        last_name: moltinShippingAddress.last_name,
        line_1: moltinShippingAddress.line_1,
        line_2: moltinShippingAddress.line_2,
        city: moltinShippingAddress.city,
        postcode: moltinShippingAddress.postcode,
        country: findCountry(moltinShippingAddress.country),
      },
      products: moltinProducts,
      amount: moltinAmount,
      total: moltinTotal,
      tax: moltinTax,
      shipping: moltinShipping,
      shipping_set: shippingSet,
      shipping_cost: moltinShippingCost
    }
  })
  .then((response) => {
    console.log(
      'The vendor notification has been sent'
    )
  }).catch((error) => {
    console.error(error)
  })
}

app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'static')))

app.post('/', function (req, res) {
  const moltinNotfication = req.body
  const moltinResources = JSON.parse(moltinNotfication.resources)
  const moltinItems = moltinResources.included.items

  res.sendStatus(200)

  sendMail(moltinResources, req)
  manageStock(moltinItems)
})

app.listen(port, function () {
  console.log(`Listening on port ${port}`)
})