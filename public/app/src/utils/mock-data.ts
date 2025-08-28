import type { OrderDetails } from "@/types"

// Generate mock order details based on order ID
export function getMockOrderDetails(orderId: string): OrderDetails {
  // Use the order ID to deterministically generate order details
  const hash = orderId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)

  // Determine order status based on hash
  const statuses = ["Processing", "Shipped", "Delivered", "Cancelled"]
  const statusIndex = hash % statuses.length
  const status = statuses[statusIndex]

  // Generate order date (between 1-30 days ago)
  const daysAgo = (hash % 30) + 1
  const orderDate = new Date()
  orderDate.setDate(orderDate.getDate() - daysAgo)
  const dateString = orderDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  // Generate mock items
  const itemCount = (hash % 3) + 1 // 1-3 items
  const items = []

  const productNames = [
    "Wireless Earbuds",
    "Smart Watch",
    "Bluetooth Speaker",
    "Noise-Cancelling Headphones",
    "Portable Charger",
    "Laptop Stand",
    "Mechanical Keyboard",
    "Ergonomic Mouse",
    "USB-C Hub",
    "Phone Case",
  ]

  for (let i = 0; i < itemCount; i++) {
    const productIndex = (hash + i) % productNames.length
    const quantity = ((hash + i) % 3) + 1 // 1-3 quantity
    const price = ((hash + i) % 50) + 20 // $20-$70 price

    items.push({
      name: productNames[productIndex],
      quantity,
      price: `$${price.toFixed(2)}`,
    })
  }

  // Generate shipping address (masked for privacy)
  const addresses = [
    "123 Main St, New York, NY 10001",
    "456 Oak Ave, Los Angeles, CA 90001",
    "789 Pine Rd, Chicago, IL 60007",
    "321 Maple Dr, Houston, TX 77001",
    "654 Cedar Ln, Miami, FL 33101",
  ]
  const addressIndex = hash % addresses.length
  const address = addresses[addressIndex]

  // Create the order details object
  const orderDetails: OrderDetails = {
    orderId,
    status,
    date: dateString,
    items,
    shippingAddress: address,
  }

  // Add tracking number and estimated delivery for shipped orders
  if (status === "Shipped" || status === "Delivered") {
    orderDetails.trackingNumber = `TRK${hash.toString().substring(0, 8).padStart(8, "0")}`

    if (status === "Shipped") {
      const deliveryDate = new Date()
      deliveryDate.setDate(deliveryDate.getDate() + ((hash % 5) + 1)) // 1-5 days from now
      orderDetails.estimatedDelivery = deliveryDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }
  }

  return orderDetails
}
