'use client';

import React, { useState } from 'react';
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
import { createTransaction, TransactionCreate } from '@/lib/api';
import { useRouter } from 'next/navigation';

type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
type AccountType = 'ISA' | 'OVERSEAS' | 'PENSION';
type AccountSilo = 'ISA_ETF' | 'OVERSEAS_ETF' | 'BRAZIL_BOND';

type TransactionFormState = {
  symbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  total_amount: number;
  note: string;
  date: string;
  account_type: AccountType;
  account_silo: AccountSilo;
};

const defaultFormState = (): TransactionFormState => ({
  symbol: '',
  type: 'BUY',
  quantity: 0,
  price: 0,
  total_amount: 0,
  note: '',
  date: new Date().toISOString().split('T')[0],
  account_type: 'OVERSEAS',
  account_silo: 'OVERSEAS_ETF',
});

const isCashflowType = (type: TransactionType): type is 'DEPOSIT' | 'WITHDRAW' =>
  type === 'DEPOSIT' || type === 'WITHDRAW';

const inferAccountType = (silo: AccountSilo): AccountType => (silo === 'ISA_ETF' ? 'ISA' : 'OVERSEAS');

export function AddAssetModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<TransactionFormState>(defaultFormState);

  const transactionKindLabel = isCashflowType(formData.type) ? 'cashflow' : 'trade';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitData: TransactionCreate = isCashflowType(formData.type)
        ? {
            type: formData.type,
            total_amount: formData.total_amount,
            date: formData.date,
            account_type: formData.account_type,
            account_silo: formData.account_silo,
            note: formData.note || undefined,
          }
        : {
            symbol: formData.symbol,
            type: formData.type,
            quantity: formData.quantity,
            price: formData.price || undefined,
            date: formData.date,
            account_type: formData.account_type,
            account_silo: formData.account_silo,
          };

      await createTransaction(submitData);
      setOpen(false);
      setFormData(defaultFormState());
      router.refresh();
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
          Add Transaction
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Add Transaction</SheetTitle>
          <SheetDescription>
            Record a new {transactionKindLabel} entry for your portfolio.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.type}
              onChange={(e) => {
                const nextType = e.target.value as TransactionType;
                setFormData((prev) => ({
                  ...prev,
                  type: nextType,
                  symbol: isCashflowType(nextType) ? '' : prev.symbol,
                  quantity: isCashflowType(nextType) ? 0 : prev.quantity,
                  price: isCashflowType(nextType) ? 0 : prev.price,
                  total_amount: isCashflowType(nextType) ? prev.total_amount : 0,
                  note: isCashflowType(nextType) ? prev.note : '',
                }));
              }}
              required
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAW">WITHDRAW</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.account_silo}
              onChange={(e) => {
                const silo = e.target.value as AccountSilo;
                setFormData((prev) => ({
                  ...prev,
                  account_silo: silo,
                  account_type: inferAccountType(silo),
                }));
              }}
              required
            >
              <option value="OVERSEAS_ETF">Overseas ETF</option>
              <option value="ISA_ETF">ISA ETF</option>
              <option value="BRAZIL_BOND">Brazil Bond</option>
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Choose the portfolio silo this entry belongs to.</p>
          </div>

          {!isCashflowType(formData.type) ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Symbol (Ticker)</label>
                <Input
                  type="text"
                  placeholder="e.g. KODEX_1X, MSTR"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  기존 KR ETF: 심볼 그대로 (NDX_1X, ACE_TLT)　신규 KR ETF: 6자리 KRX 코드 (e.g. 476760)　해외 자산: 티커 그대로 (MSTR, DBMF)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Price (Optional)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Leave empty for auto current market price"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">If empty, real-time price will be fetched.</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cash Amount</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formData.total_amount || ''}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">Use a positive amount. Direction comes from the selected type.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. salary contribution"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </>
          )}

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
              {submitting ? 'Saving...' : `Add ${isCashflowType(formData.type) ? 'Cashflow' : 'Trade'}`}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
