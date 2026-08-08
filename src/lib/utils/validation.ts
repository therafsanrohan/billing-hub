import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  sku: z.string().max(50, "SKU must be less than 50 characters").optional(),
  selling_price: z.coerce.number().min(0, "Selling price cannot be negative"),
  cost_price: z.coerce.number().min(0, "Cost price cannot be negative").optional().default(0),
  low_stock_level: z.coerce.number().int().min(0, "Low stock level must be at least 0").default(5),
});

export const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().max(20, "Phone number is too long").optional(),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  address: z.string().max(255).optional(),
});

export const expenseSchema = z.object({
  category: z.string().min(2, "Category is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().max(255).optional(),
  date: z.string().min(1, "Date is required"),
});

// Helper for validating and formatting errors
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    // Return first error message
    return { success: false, error: result.error.issues[0].message };
  }
}
