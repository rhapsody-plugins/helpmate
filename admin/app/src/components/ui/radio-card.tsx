"use client"

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import * as React from "react"

import { cn } from "@/lib/utils"

function RadioCardGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-card-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioCard({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      className={cn(
        "peer sr-only",
        className
      )}
      {...props}
    />
  )
}

function RadioCardLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="radio-card-label"
      className={cn(
        "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}

export { RadioCard, RadioCardGroup, RadioCardLabel }
