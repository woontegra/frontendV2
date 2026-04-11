import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

const PACKAGE_OPTIONS = [
  { value: "demo", label: "Demo" },
  { value: "starter", label: "Starter" },
  { value: "professional_monthly", label: "Professional Aylık" },
  { value: "professional_yearly", label: "Professional Yıllık" },
] as const;

export interface LicenseRow {
  userId: number;
  email: string;
  name: string;
  tenantId: number;
  packageType: string | null;
  packageLabel: string;
  licenseStart: string | null;
  licenseEnd: string | null;
  remainingDays: number;
  calculationCount: number;
  lastLoginAt: string | null;
  status: string;
}

interface LicenseEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: LicenseRow | null;
  onSaved: () => void;
  saveLicense: (payload: {
    userId: number;
    newPackage?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

function toDateOnly(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function LicenseEditModal({
  open,
  onOpenChange,
  row,
  onSaved,
  saveLicense,
}: LicenseEditModalProps) {
  const [newPackage, setNewPackage] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (row) {
      setNewPackage(row.packageType || "professional_monthly");
      setStartDate(toDateOnly(row.licenseStart));
      setEndDate(toDateOnly(row.licenseEnd));
      setErrorMsg("");
    }
  }, [row]);

  const handleSave = async () => {
    if (!row) return;
    const end = endDate ? new Date(endDate) : null;
    if (!end || isNaN(end.getTime())) {
      setErrorMsg("Bitiş tarihi geçerli olmalı");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const result = await saveLicense({
        userId: row.userId,
        newPackage: newPackage || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (result.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setErrorMsg(result.error || "Kaydetme başarısız");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lisans Yönet</DialogTitle>
          <DialogDescription>
            Kullanıcı lisansını güncelleyin. Başlangıç ve bitiş tarihleri zorunludur.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Kullanıcı E-posta</Label>
            <Input value={row?.email ?? ""} readOnly className="bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="grid gap-2">
            <Label>Mevcut Paket</Label>
            <Input value={row?.packageLabel ?? "—"} readOnly className="bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="grid gap-2">
            <Label>Yeni Paket</Label>
            <Select value={newPackage} onChange={(e) => setNewPackage(e.target.value)}>
              <option value="">Paket seçin</option>
              {PACKAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Başlangıç Tarihi</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Bitiş Tarihi</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {errorMsg && <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
