'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter,
  SheetClose
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { getAssets, createTransaction, Asset, TransactionCreate } from '@/lib/api';
import { useRouter } from 'next/navigation';

export function AddAssetModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<TransactionCreate>({
    symbol: '',
    type: 'BUY',
    quantity: 0,
    price: 0,
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTransaction(formData);
      setOpen(false);
      // Reset form
      setFormData({
        symbol: '',
        type: 'BUY',
        quantity: 0,
        price: 0,
        date: new Date().toISOString().split('T')[0],
      });
      router.refresh();
      // Optional: alert or toast
      // alert('Transaction added successfully!');
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert(error instanceof Error ? error.message : 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Add Transaction</SheetTitle>
          <SheetDescription>
            Record a new buy or sell transaction for your portfolio.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Asset Symbol (Ticker)</label>
            <Input 
              type="text" 
              placeholder="e.g. QQQ or 409820"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">Enter US Ticker or 6-digit KR Code</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'BUY' | 'SELL' })}
              required
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity</label>
            <Input 
              type="number" 
              step="any"
              placeholder="0.00"
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Price</label>
            <Input 
              type="number" 
              step="any"
              placeholder="0.00"
              value={formData.price || ''}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <SheetFooter className="pt-4">
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Transaction'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
