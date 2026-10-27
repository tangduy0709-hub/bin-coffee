import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatVND(price: number): string {
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}đ`
}
export function formatPrice(amountInVND: number, lang: 'vi' | 'en') {
  if (lang === 'en') {
    // Tỷ giá quy đổi giả định: 1 USD = 25.000 VNĐ
    const exchangeRate = 25000;
    const amountInUSD = amountInVND / exchangeRate;
    
    // Định dạng kiểu tiền tệ USD ($)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amountInUSD);
  }

  // Mặc định hiển thị VNĐ khi ở tiếng Việt
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amountInVND).replace('₫', 'đ');
}