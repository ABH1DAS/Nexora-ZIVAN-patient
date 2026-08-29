"use client";

import {
  addEmergencyContact as addSupabaseContact,
  fetchEmergencyContacts as fetchSupabaseContacts,
  removeEmergencyContact as removeSupabaseContact,
  isSupabaseConfigured,
} from "@/lib/supabase";

export interface EmergencyContactItem {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: "Primary" | "Secondary";
}

const STORAGE_KEY = "zivan-emergency-contacts";

const DEFAULT_CONTACTS: EmergencyContactItem[] = [
  {
    id: "contact_1",
    name: "Dr. Ananya Sharma",
    phone: "+91 98765 43210",
    relationship: "Family Doctor",
    priority: "Primary",
  },
  {
    id: "contact_2",
    name: "Rajesh Kumar",
    phone: "+91 98123 45678",
    relationship: "Spouse",
    priority: "Primary",
  },
  {
    id: "contact_3",
    name: "Priya Roy",
    phone: "+91 97111 22334",
    relationship: "Sister",
    priority: "Secondary",
  },
];

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getEmergencyContacts(): EmergencyContactItem[] {
  if (!canUseStorage()) return DEFAULT_CONTACTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTACTS;
    const parsed = JSON.parse(raw) as EmergencyContactItem[];
    return parsed.length > 0 ? parsed : DEFAULT_CONTACTS;
  } catch {
    return DEFAULT_CONTACTS;
  }
}

export function saveEmergencyContacts(contacts: EmergencyContactItem[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  window.dispatchEvent(new CustomEvent("zivan-contacts-updated", { detail: contacts }));
}

export function addEmergencyContact(contact: Omit<EmergencyContactItem, "id">): EmergencyContactItem {
  const newContact: EmergencyContactItem = {
    ...contact,
    id: `contact_${Date.now()}`,
  };
  const current = getEmergencyContacts();
  const updated = [newContact, ...current];
  saveEmergencyContacts(updated);

  // Sync to Supabase in real-time
  if (isSupabaseConfigured) {
    addSupabaseContact({
      patient_id: "demo-user",
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      priority: contact.priority,
    }).then((created) => {
      if (created && created.id) {
        // Update local contact with server id if needed
        const local = getEmergencyContacts().map((c) =>
          c.id === newContact.id ? { ...c, id: created.id! } : c
        );
        saveEmergencyContacts(local);
      }
    });
  }

  return newContact;
}

export function removeEmergencyContact(id: string): void {
  const current = getEmergencyContacts();
  const updated = current.filter((c) => c.id !== id);
  saveEmergencyContacts(updated);

  // Sync delete to Supabase
  if (isSupabaseConfigured) {
    removeSupabaseContact(id);
  }
}

export function subscribeEmergencyContacts(
  listener: (contacts: EmergencyContactItem[]) => void,
) {
  // Sync from Supabase on subscription
  if (isSupabaseConfigured) {
    fetchSupabaseContacts("demo-user").then((remote) => {
      if (remote && remote.length > 0) {
        const mapped: EmergencyContactItem[] = remote.map((c) => ({
          id: c.id || `contact_${Date.now()}`,
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
          priority: c.priority,
        }));
        saveEmergencyContacts(mapped);
        listener(mapped);
      }
    });
  }

  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getEmergencyContacts());
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) emit();
  };
  const onCustom = () => emit();

  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-contacts-updated", onCustom);
  emit();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-contacts-updated", onCustom);
  };
}
