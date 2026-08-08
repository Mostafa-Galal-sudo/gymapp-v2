import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNutritionStore } from '../store/useNutritionStore';
import type { LoggedFood, NutritionDay } from '../store/useNutritionStore';
import { useUserStore } from '../store/useUserStore';
import { startOfDay, format } from 'date-fns';

import { FOOD_DATABASE } from '../data/foods';
import type { Food } from '../data/foods';
import { useGamificationStore } from '../store/useGamificationStore';
import { Search, Plus, X, Droplet, Check, ChevronDown, RotateCcw, Calendar, ChevronLeft, ChevronRight, Camera, Sparkles, Loader2, ChefHat, Trash2 } from 'lucide-react';

import { useT } from '../hooks/useT';
import { useLanguageStore } from '../store/useLanguageStore';
import db from '../db/db';

// ── Circular Macro Ring ──────────────────────────────────────────────────────
const MacroRing = ({ value, target, label, color, size = 72 }: {
  value: number; target: number; label: string; color: string; size?: number;
}) => {
  const pct = Math.min(1, value / Math.max(1, target));
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const over = pct >= 1;
  const displayColor = over ? 'var(--color-warning)' : color;
  return (
    <div className="macro-ring-wrap">
      <div className="water-ring-container" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={displayColor} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.7s var(--ease-out)', filter: `drop-shadow(0 0 4px ${displayColor})` }}
          />
        </svg>
        <div className="water-ring-center">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: size < 80 ? '0.8rem' : '1rem', fontWeight: 700, color: displayColor, lineHeight: 1 }}>
            {Math.round(value)}
          </span>
          {target > 0 && <span style={{ fontSize: '0.5rem', color: 'var(--color-text-muted)', opacity: 0.8 }}>/{target}</span>}
        </div>
      </div>
      <span className="macro-ring-label">{label}</span>
    </div>
  );
};

// ── Macro Bar ──────────────────────────────────────────────────────────────────
const MacroBar = ({ label, current, target, gradient, unit = 'g' }: {
  label: string; current: number; target: number; gradient: string; unit?: string;
}) => {
  const pct = Math.min(100, (current / target) * 100);
  const over = pct >= 100;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: over ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
          {Math.round(current)}<span style={{ opacity: 0.5 }}>/{target}{unit}</span>
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill"
          style={{ width: `${pct}%`, background: over ? 'linear-gradient(90deg,#ffaa00,#ff6600)' : gradient }}
        />
      </div>
    </div>
  );
};


// ── Water Section ────────────────────────────────────────────────────────────
const WaterSection = ({ current, target, onAdd, onReset }: {
  current: number; target: number; onAdd: (ml: number) => void; onReset: () => void;
}) => {
  const pct = Math.min(1, current / Math.max(1, target));
  const size = 100;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Circular Water Ring */}
        <div className="water-ring-container" style={{ width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke="rgba(0,240,255,0.1)" strokeWidth={10} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke="var(--cyan)" strokeWidth={10}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.7s var(--ease-out)', filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.6))' }}
            />
          </svg>
          <div className="water-ring-center" style={{ flexDirection: 'column' }}>
            <Droplet size={14} color="var(--cyan)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--cyan)', lineHeight: 1 }}>
              {current}
            </span>
            <span style={{ fontSize: '0.48rem', color: 'var(--color-text-muted)' }}>/{target}ml</span>
          </div>
        </div>
        {/* Quick Add Buttons */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>💧 Water Intake</span>
            <button onClick={onReset} style={{ background: 'none', border: 'none', color: 'rgba(255,0,0,0.5)', display: 'flex', cursor: 'pointer' }}>
              <RotateCcw size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            {[150, 250, 350, 500].map(ml => (
              <button key={ml} onClick={() => onAdd(ml)}
                style={{
                  padding: '0.55rem 0.2rem',
                  fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  border: '1px solid rgba(0,240,255,0.25)', borderRadius: 'var(--radius-md)',
                  color: 'var(--cyan)', background: 'rgba(0,240,255,0.06)',
                  transition: 'all 0.2s', cursor: 'pointer',
                }}
              >+{ml}ml</button>
            ))}
          </div>
          <div className="macro-bar-track" style={{ marginTop: '0.6rem', height: 6 }}>
            <div className="macro-bar-fill"
              style={{ width: `${Math.min(100, pct * 100)}%`, background: 'linear-gradient(90deg,var(--cyan),#0044ff)', height: 6 }} />
          </div>
        </div>
      </div>
    </div>
  );
};



// ── Supplement Checklist ──────────────────────────────────────────────────────
const Supplements = ({ todayLog, onReset }: { todayLog: NutritionDay, onReset: () => void }) => {
  const supplements = useUserStore(s => s.supplements);
  const toggleSupplement = useNutritionStore(s => s.toggleSupplement);
  const t = useT();

  const handleToggle = (supId: string, di: number, isTaken: boolean) => {
    toggleSupplement(todayLog.date, supId, di);
    if (!isTaken) useGamificationStore.getState().addXP(1);
  };

  if (!supplements || supplements.length === 0) return null;

  const supsTaken = todayLog.supplementsTaken || {};

  return (
    <div>
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--magenta)' }}>{t('nutrition.supplements')}</span>
        <button onClick={onReset} style={{ background: 'none', border: 'none', color: 'rgba(255,0,0,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="glass-card" style={{ padding: '1rem' }}>
        {supplements.map((sup, si) => {
          const takenArr = supsTaken[sup.id] || Array(sup.taken.length).fill(false);
          return (
            <div key={sup.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 0',
              borderBottom: si < supplements.length - 1 ? '1px solid rgba(0,240,255,0.06)' : 'none',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sup.name}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8rem', marginInlineStart: '0.5rem' }}>{sup.dose}</span>
                  {[sup.calories, sup.protein, sup.vitaminD, sup.vitaminB12, sup.magnesium, sup.zinc].some(v => v != null && v > 0) && (
                    <span title={t('profile.nutrient_contribution')} style={{ marginInlineStart: '0.4rem', fontSize: '0.62rem', color: 'var(--cyan)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 4, padding: '0.05rem 0.3rem' }}>
                      {t('profile.counts_toward_nutrition')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{sup.timing}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {sup.taken.map((_, di) => {
                  const isTaken = takenArr[di] || false;
                  return (
                    <button key={di} onClick={() => handleToggle(sup.id, di, isTaken)} style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: isTaken ? 'var(--color-success)' : 'rgba(0,240,255,0.05)',
                      border: `1px solid ${isTaken ? 'var(--color-success)' : 'rgba(0,240,255,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isTaken ? '0 0 8px rgba(0,255,136,0.4)' : 'none',
                      transition: 'all 0.2s',
                      color: isTaken ? '#000' : 'var(--color-text-muted)',
                      fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      {isTaken ? <Check size={16} strokeWidth={3} /> : `${di + 1}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Nutrition Page ────────────────────────────────────────────────────────────
const FoodResultRow = ({ food, onAdd }: { food: Food, onAdd: (food: Food, quantity: number) => void }) => {
  const t = useT();
  const [qty, setQty] = useState(food.servingSize);
  const fName = useLanguageStore.getState().lang === 'ar' && food.nameAr ? food.nameAr : food.name;

  const categoryColor = (cat: string) => ({
    Local: 'var(--gold)', International: 'var(--magenta)',
    Raw: 'var(--color-success)', Supplement: 'var(--cyan)',
  }[cat] || 'var(--color-text-muted)');

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.75rem 1rem', borderBottom: '1px solid rgba(0,240,255,0.06)'
    }}>
      <div style={{ flex: 1, paddingInlineEnd: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{fName}</span>
          <span style={{ fontSize: '0.55rem', color: categoryColor(food.category), fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0.1rem 0.3rem', border: `1px solid ${categoryColor(food.category)}`, borderRadius: 4 }}>
            {t(`nutrition.cat_${food.category.toLowerCase()}` as any, food.category)}
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
          {food.calories}kcal · P:{food.protein}g · C:{food.carbs}g · F:{food.fats}g (per {food.servingSize}{food.servingUnit})
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '0.2rem', width: '70px' }}>
          <input
            type="number"
            value={qty || ''}
            onChange={e => setQty(parseFloat(e.target.value) || 0)}
            style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', textAlign: 'center', padding: 0 }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{food.servingUnit}</span>
        </div>
        <button onClick={() => onAdd(food, qty)} style={{
          background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.25)',
          borderRadius: 'var(--radius-full)', width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--cyan)'
        }}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

// ── Recipe Builder ─────────────────────────────────────────────────────────
const RecipesSection = ({ mealType, onLogged }: { mealType: string; onLogged: () => void }) => {
  const t = useT();
  const recipes = useNutritionStore(s => s.recipes);
  const saveRecipe = useNutritionStore(s => s.saveRecipe);
  const deleteRecipe = useNutritionStore(s => s.deleteRecipe);
  const logRecipe = useNutritionStore(s => s.logRecipe);

  const [showCreator, setShowCreator] = useState(false);
  const [name, setName] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftItems, setDraftItems] = useState<{ foodId: string; name: string; amount: number }[]>([]);

  const draftResults = draftSearch.length > 1
    ? FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(draftSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleSave = () => {
    if (!name.trim() || draftItems.length === 0) return;
    saveRecipe(name.trim(), draftItems.map(i => ({ foodId: i.foodId, amount: i.amount })));
    setName('');
    setDraftItems([]);
    setDraftSearch('');
    setShowCreator(false);
  };

  const handleLog = (recipeId: string) => {
    const today = startOfDay(new Date()).getTime();
    logRecipe(today, mealType, recipeId);
    onLogged();
  };

  return (
    <div data-walkthrough="recipes-section" className="glass-card" style={{ padding: '1rem', marginBottom: '0.75rem', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: recipes.length > 0 || showCreator ? '0.75rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700 }}>
          <ChefHat size={15} color="var(--cyan)" /> {t('nutrition.recipes') || 'Saved Recipes'}
        </div>
        <button onClick={() => setShowCreator(v => !v)} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.7rem' }}>
          <Plus size={12} /> {t('nutrition.new_recipe') || 'New Recipe'}
        </button>
      </div>

      {recipes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: showCreator ? '0.75rem' : 0 }}>
          {recipes.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.2)',
              borderRadius: 20, padding: '0.3rem 0.3rem 0.3rem 0.7rem', fontSize: '0.72rem'
            }}>
              <span>{r.name}</span>
              <button onClick={() => handleLog(r.id)} style={{ color: 'var(--cyan)', padding: '0.15rem' }}>
                <Plus size={12} />
              </button>
              <button onClick={() => deleteRecipe(r.id)} style={{ color: 'var(--color-text-muted)', padding: '0.15rem' }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreator && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
          <input
            type="text" placeholder={t('nutrition.recipe_name') || 'Recipe name (e.g. Post-Workout Shake)'}
            value={name} onChange={e => setName(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.8rem' }}
          />
          <input
            type="text" placeholder={t('nutrition.search') || 'Search food to add...'}
            value={draftSearch} onChange={e => setDraftSearch(e.target.value)}
            style={{ width: '100%', marginBottom: '0.4rem', fontSize: '0.8rem' }}
          />
          {draftResults.length > 0 && (
            <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: '0.5rem' }}>
              {draftResults.map(f => (
                <div key={f.id} onClick={() => {
                  setDraftItems(prev => [...prev, { foodId: f.id, name: f.name, amount: f.servingSize }]);
                  setDraftSearch('');
                }} style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {f.name} <span style={{ color: 'var(--color-text-muted)' }}>({f.servingSize}{f.servingUnit})</span>
                </div>
              ))}
            </div>
          )}

          {draftItems.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              {draftItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <input
                    type="number" value={item.amount}
                    onChange={e => setDraftItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: parseFloat(e.target.value) || 0 } : it))}
                    style={{ width: 60, fontSize: '0.72rem', padding: '0.25rem' }}
                  />
                  <button onClick={() => setDraftItems(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'var(--magenta)', padding: '0.15rem' }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSave} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', fontSize: '0.8rem' }} disabled={!name.trim() || draftItems.length === 0}>
            <Check size={14} /> {t('nutrition.save_recipe') || 'Save Recipe'}
          </button>
        </div>
      )}
    </div>
  );
};


const Nutrition = () => {
  const t = useT();
  const profile = useUserStore(s => s.profile);
  const getLogForDate = useNutritionStore(s => s.getLogForDate);
  const historyData = useNutritionStore(s => s.history);
  const getTargets = useNutritionStore(s => s.getTargets);
  const addFood = useNutritionStore(s => s.addFood);
  const removeFood = useNutritionStore(s => s.removeFood);
  const addWater = useNutritionStore(s => s.addWater);
  const resetMeal = useNutritionStore(s => s.resetMeal);
  const resetWater = useNutritionStore(s => s.resetWater);
  const resetSupplements = useNutritionStore(s => s.resetSupplements);
  const addXP = useGamificationStore(s => s.addXP);

  // Historical date state
  const [selectedDate, setSelectedDate] = useState<number>(startOfDay(new Date()).getTime());
  const todayLog = historyData[selectedDate] || getLogForDate(selectedDate);
  const targets = getTargets(profile.weight);

  // Search, custom foods, and AI Scanner states
  const [search, setSearch] = useState('');
  const [searchTab, setSearchTab] = useState<'all' | 'raw'>('all');
  const [mealType, setMealType] = useState('Breakfast');
  const [openMeals, setOpenMeals] = useState<Record<string, boolean>>({ Breakfast: true });
  const [showMicros, setShowMicros] = useState(false);

  const [customFoods, setCustomFoods] = useState<any[]>([]);
  const [showAddCustomFood, setShowAddCustomFood] = useState(false);
  const [newCustomFood, setNewCustomFood] = useState({
    name: '', nameAr: '', category: 'Protein', calories: 150, protein: 15, carbs: 10, fats: 3, fiber: 0, sodium: 0, servingSize: 100, servingUnit: 'g'
  });

  const [aiScanning, setAiScanning] = useState(false);
  const [aiScanResult, setAiScanResult] = useState<any | null>(null);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const barcodeScannerRef = useRef<any>(null);
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);
  const [offScanResult, setOffScanResult] = useState<Food | null>(null);

  const loadCustomFoods = async () => {
    const userId = useUserStore.getState().activeUserId || 'default_user';
    const list = await db.custom_foods.where('userId').equals(userId).toArray();
    setCustomFoods(list);
  };

  useEffect(() => {
    loadCustomFoods();
  }, []);

  const changeDay = (days: number) => {
    setSelectedDate(prev => prev + days * 24 * 60 * 60 * 1000);
  };

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiScanning(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const base64WithHeader = event.target?.result as string;
        const base64Data = base64WithHeader.split(',')[1];
        const mimeType = file.type;

        const res = await fetch('/api/ai/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Data, mimeType })
        });

        if (!res.ok) throw new Error('Failed to analyze image');
        const result = await res.json();
        setAiScanResult(result);
        setShowAiResultModal(true);
      } catch (error) {
        console.error('Error scanning food:', error);
        alert(t('nutrition.ai_scan_failed'));
      } finally {
        setAiScanning(false);
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      setAiScanning(false);
    };

    reader.readAsDataURL(file);
  };

  const startBarcodeScanner = async () => {
    setShowBarcodeScanner(true);
    // slight delay to ensure DOM element is rendered
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('barcode-reader-container');
        barcodeScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (decodedText: string) => {
            stopBarcodeScanner();
            // Try the local database first (it only has a handful of curated
            // barcodes), then fall back to Open Food Facts — a free, public,
            // no-API-key-required database with real barcodes for millions
            // of real-world products.
            const found = FOOD_DATABASE.find((f: any) => f.barcode === decodedText);
            if (found) {
              handleAdd(found, found.servingSize);
              setSearch(found.name);
              return;
            }

            setSearch(decodedText);
            setBarcodeLookupLoading(true);
            try {
              const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json`);
              const data = await res.json();
              if (data.status === 1 && data.product) {
                const p = data.product;
                const n = p.nutriments || {};
                const offFood: Food = {
                  id: `off_${decodedText}`,
                  name: p.product_name || p.generic_name || decodedText,
                  category: 'International',
                  calories: Math.round(n['energy-kcal_100g'] || 0),
                  protein: Math.round((n['proteins_100g'] || 0) * 10) / 10,
                  carbs: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
                  fats: Math.round((n['fat_100g'] || 0) * 10) / 10,
                  fiber: n['fiber_100g'] != null ? Math.round(n['fiber_100g'] * 10) / 10 : undefined,
                  sugar: n['sugars_100g'] != null ? Math.round(n['sugars_100g'] * 10) / 10 : undefined,
                  sodium: n['sodium_100g'] != null ? Math.round(n['sodium_100g'] * 1000) : undefined, // g -> mg
                  servingSize: 100,
                  servingUnit: 'g',
                  barcode: decodedText,
                };
                setOffScanResult(offFood);
              } else {
                setOffScanResult(null);
              }
            } catch (err) {
              console.error('Open Food Facts lookup failed:', err);
              setOffScanResult(null);
            } finally {
              setBarcodeLookupLoading(false);
            }
          },
          () => {/* ignore frame errors */ }
        );
      } catch (err) {
        console.error('Barcode scanner error:', err);
        setShowBarcodeScanner(false);
      }
    }, 300);
  };

  const stopBarcodeScanner = () => {
    if (barcodeScannerRef.current) {
      barcodeScannerRef.current.stop().catch(() => { });
      barcodeScannerRef.current = null;
    }
    setShowBarcodeScanner(false);
  };

  const handleCreateCustomFood = async () => {
    if (!newCustomFood.name) return;
    const userId = useUserStore.getState().activeUserId || 'default_user';
    const foodId = 'custom_' + Math.random().toString(36).substring(2, 9);
    const item = {
      id: foodId,
      userId,
      name: newCustomFood.name,
      nameAr: newCustomFood.nameAr || newCustomFood.name,
      category: newCustomFood.category,
      calories: Number(newCustomFood.calories) || 0,
      protein: Number(newCustomFood.protein) || 0,
      carbs: Number(newCustomFood.carbs) || 0,
      fats: Number(newCustomFood.fats) || 0,
      fiber: Number(newCustomFood.fiber) || 0,
      sodium: Number(newCustomFood.sodium) || 0,
      servingSize: Number(newCustomFood.servingSize) || 100,
      servingUnit: newCustomFood.servingUnit || 'g'
    };
    await db.custom_foods.put(item);
    await loadCustomFoods();
    setShowAddCustomFood(false);
    setNewCustomFood({
      name: '', nameAr: '', category: 'Protein', calories: 150, protein: 15, carbs: 10, fats: 3, fiber: 0, sodium: 0, servingSize: 100, servingUnit: 'g'
    });
  };

  let totalCal = 0, totalPro = 0, totalCarbs = 0, totalFats = 0;
  let tFib = 0, tSug = 0, tSod = 0, tPot = 0, tIron = 0, tCal = 0, tVitA = 0, tVitC = 0, tVitD = 0, tVitB12 = 0;
  let tMag = 0, tZinc = 0, tPhos = 0, tVitE = 0, tVitK = 0, tVitB6 = 0, tFolate = 0;

  todayLog.meals.forEach(m => m.foods.forEach(f => {
    totalCal += f.calories;
    totalPro += f.protein;
    totalCarbs += f.carbs;
    totalFats += f.fats;
    tFib += f.fiber || 0;
    tSug += f.sugar || 0;
    tSod += f.sodium || 0;
    tPot += f.potassium || 0;
    tIron += f.iron || 0;
    tCal += f.calcium || 0;
    tVitA += f.vitaminA || 0;
    tVitC += f.vitaminC || 0;
    tVitD += f.vitaminD || 0;
    tVitB12 += f.vitaminB12 || 0;
    tMag += f.magnesium || 0;
    tZinc += f.zinc || 0;
    tPhos += f.phosphorus || 0;
    tVitE += f.vitaminE || 0;
    tVitK += f.vitaminK || 0;
    tVitB6 += f.vitaminB6 || 0;
    tFolate += f.folate || 0;
  }));

  const allFoods = [...FOOD_DATABASE, ...customFoods];
  const filtered = search.length > 1
    ? allFoods.filter(f => {
      if (searchTab === 'raw' && f.category !== 'Raw') return false;
      const nameMatch = f.name.toLowerCase().includes(search.toLowerCase());
      const arNameMatch = f.nameAr && f.nameAr.includes(search);
      return nameMatch || arNameMatch;
    }).slice(0, 10)
    : [];

  const handleAdd = (food: Food, quantity: number) => {
    if (quantity <= 0) return;
    const ratio = quantity / food.servingSize;

    // ── Scaled macros ──────────────────────────────────────────────────────
    const scaledCal = Math.round(food.calories * ratio);
    const scaledProtein = parseFloat((food.protein * ratio).toFixed(1));
    const scaledCarbs = parseFloat((food.carbs * ratio).toFixed(1));
    const scaledFats = parseFloat((food.fats * ratio).toFixed(1));

    // ── Micronutrients: use food DB value if present, else estimate from macros ──
    // Estimation formulas (per scaled portion):
    //   fiber     ≈ carbs × 2%  + protein × 0.5%
    //   sugar     ≈ carbs × 5%
    //   sodium    ≈ protein × 6 + carbs × 0.5 + calories × 0.08
    //   potassium ≈ protein × 12 + carbs × 1.5 + fats × 0.5
    //   iron      ≈ protein × 0.04 + carbs × 0.008
    //   calcium   ≈ protein × 0.6 + carbs × 0.1 + fats × 0.2
    //   vitaminC  ≈ carbs × 0.15
    //   vitaminA  ≈ fats × 0.8
    //   vitaminD  ≈ fats × 0.05
    const est = {
      fiber: parseFloat((scaledCarbs * 0.02 + scaledProtein * 0.005).toFixed(1)),
      sugar: parseFloat((scaledCarbs * 0.05).toFixed(1)),
      sodium: Math.round(scaledProtein * 6 + scaledCarbs * 0.5 + scaledCal * 0.08),
      potassium: Math.round(scaledProtein * 12 + scaledCarbs * 1.5 + scaledFats * 0.5),
      iron: parseFloat((scaledProtein * 0.04 + scaledCarbs * 0.008).toFixed(1)),
      calcium: Math.round(scaledProtein * 0.6 + scaledCarbs * 0.1 + scaledFats * 0.2),
      vitaminC: Math.round(scaledCarbs * 0.15),
      vitaminA: Math.round(scaledFats * 0.8),
      vitaminD: parseFloat((scaledFats * 0.05).toFixed(1)),
      magnesium: Math.round(scaledProtein * 0.8 + scaledCarbs * 0.15),
      zinc: parseFloat((scaledProtein * 0.03).toFixed(1)),
      phosphorus: Math.round(scaledProtein * 4 + scaledCarbs * 0.3),
      vitaminE: parseFloat((scaledFats * 0.02).toFixed(1)),
      vitaminB6: parseFloat((scaledProtein * 0.006).toFixed(2)),
      folate: Math.round(scaledCarbs * 0.2),
    };

    const logged: LoggedFood = {
      foodId: food.id, name: food.name, nameAr: food.nameAr,
      amount: quantity, unit: food.servingUnit,
      calories: scaledCal,
      protein: scaledProtein,
      carbs: scaledCarbs,
      fats: scaledFats,
      // Use DB value if present, fall back to macro-based estimate
      fiber: food.fiber != null ? parseFloat((food.fiber * ratio).toFixed(1)) : est.fiber,
      sugar: food.sugar != null ? parseFloat((food.sugar * ratio).toFixed(1)) : est.sugar,
      sodium: food.sodium != null ? Math.round(food.sodium * ratio) : est.sodium,
      potassium: food.potassium != null ? Math.round(food.potassium * ratio) : est.potassium,
      iron: food.iron != null ? parseFloat((food.iron * ratio).toFixed(1)) : est.iron,
      calcium: food.calcium != null ? Math.round(food.calcium * ratio) : est.calcium,
      vitaminA: food.vitaminA != null ? Math.round(food.vitaminA * ratio) : est.vitaminA,
      vitaminC: food.vitaminC != null ? Math.round(food.vitaminC * ratio) : est.vitaminC,
      vitaminD: food.vitaminD != null ? Math.round(food.vitaminD * ratio) : est.vitaminD,
      vitaminB12: food.vitaminB12 != null ? parseFloat((food.vitaminB12 * ratio).toFixed(1)) : undefined,
      magnesium: food.magnesium != null ? Math.round(food.magnesium * ratio) : est.magnesium,
      zinc: food.zinc != null ? parseFloat((food.zinc * ratio).toFixed(1)) : est.zinc,
      phosphorus: food.phosphorus != null ? Math.round(food.phosphorus * ratio) : est.phosphorus,
      selenium: food.selenium != null ? parseFloat((food.selenium * ratio).toFixed(1)) : undefined,
      vitaminE: food.vitaminE != null ? parseFloat((food.vitaminE * ratio).toFixed(1)) : est.vitaminE,
      vitaminK: food.vitaminK != null ? parseFloat((food.vitaminK * ratio).toFixed(1)) : undefined,
      vitaminB6: food.vitaminB6 != null ? parseFloat((food.vitaminB6 * ratio).toFixed(2)) : est.vitaminB6,
      folate: food.folate != null ? Math.round(food.folate * ratio) : est.folate,
    };
    addFood(todayLog.date, mealType, logged);
    addXP(2);
    setSearch('');
  };


  const toggleMeal = (type: string) =>
    setOpenMeals(o => ({ ...o, [type]: !o[type] }));

  // Raw English keys (must match what's stored in DB)
  const MEAL_TYPE_KEYS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Pre-workout', 'Post-workout'];
  // Translated labels for display
  const MEAL_TYPE_LABELS: Record<string, string> = {
    'Breakfast': t('nutrition.breakfast', 'Breakfast'),
    'Lunch': t('nutrition.lunch', 'Lunch'),
    'Dinner': t('nutrition.dinner', 'Dinner'),
    'Snacks': t('nutrition.snacks', 'Snacks'),
    'Pre-workout': t('nutrition.pre_workout', 'Pre-workout'),
    'Post-workout': t('nutrition.post_workout', 'Post-workout'),
  };

  return (
    <div className="page">
      {/* Header */}
      <header style={{ marginBottom: '1.75rem' }}>
        <div className="section-label">{t('nutrition.daily_fuel')}</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', letterSpacing: '0.06em' }}>
          {t('nutrition.title')} <span className="neon-magenta">{t('nutrition.log')}</span>
        </h1>
      </header>

      {/* Date Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,240,255,0.03)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1.25rem', border: '1px solid rgba(0,240,255,0.08)' }}>
        <button onClick={() => changeDay(-1)} style={{ padding: '0.4rem', color: 'var(--cyan)', background: 'rgba(0,240,255,0.06)', borderRadius: '50%', border: 'none', display: 'flex' }}>
          <ChevronRight size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} color="var(--cyan)" />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
            {format(selectedDate, 'eeee, MMMM d')}
          </span>
          {startOfDay(new Date()).getTime() === selectedDate && (
            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'var(--cyan)', color: '#000', borderRadius: 4, fontWeight: 700 }}>{t('common.today' as any) || 'Today'}</span>
          )}
        </div>
        <button onClick={() => changeDay(1)} style={{ padding: '0.4rem', color: 'var(--cyan)', background: 'rgba(0,240,255,0.06)', borderRadius: '50%', border: 'none', display: 'flex' }}>
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Macro Summary */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        {/* Circular Macro Rings */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', marginBottom: '1.5rem',
          gap: '0.25rem',
        }}>
          <MacroRing value={Math.round(totalCal)} target={targets.calories} label={t('dash.calories')} color="var(--cyan)" size={76} />
          <MacroRing value={Math.round(totalPro)} target={targets.protein} label={t('dash.protein')} color="var(--color-success)" size={76} />
          <MacroRing value={Math.round(totalCarbs)} target={targets.carbs} label={t('nutrition.carbs')} color="var(--color-warning)" size={76} />
          <MacroRing value={Math.round(totalFats)} target={targets.fats} label={t('nutrition.fats')} color="var(--magenta)" size={76} />
        </div>
        <MacroBar label={t('dash.calories')} current={totalCal} target={targets.calories} gradient="linear-gradient(90deg,var(--cyan),#0080ff)" unit={` ${t('common.kcal')}`} />
        <MacroBar label={t('dash.protein')} current={totalPro} target={targets.protein} gradient="linear-gradient(90deg,#00ff88,var(--cyan))" />
        <MacroBar label={t('nutrition.carbs')} current={totalCarbs} target={targets.carbs} gradient="linear-gradient(90deg,var(--color-warning),#ff6600)" />
        <MacroBar label={t('nutrition.fats')} current={totalFats} target={targets.fats} gradient="linear-gradient(90deg,var(--magenta),#8800aa)" />

        <button onClick={() => setShowMicros(!showMicros)} style={{
          width: '100%', marginTop: '1rem', padding: '0.5rem', fontSize: '0.75rem',
          color: 'var(--cyan)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
        }}>
          {t('nutrition.more_nutrients')} <ChevronDown size={14} style={{ transform: showMicros ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
        {showMicros && (() => {
          const microRows = [
            { label: t('nutrition.fiber'), current: tFib, target: targets.fiber, unit: 'g', color: '#a78bfa' },
            { label: t('nutrition.sugar'), current: tSug, target: 50, unit: 'g', color: '#fb923c' },
            { label: t('nutrition.sodium'), current: tSod, target: targets.sodium, unit: 'mg', color: '#60a5fa' },
            { label: t('nutrition.potassium'), current: tPot, target: targets.potassium, unit: 'mg', color: '#a78bfa' },
            { label: t('nutrition.iron'), current: tIron, target: targets.iron, unit: 'mg', color: '#f87171' },
            { label: t('nutrition.calcium'), current: tCal, target: targets.calcium, unit: 'mg', color: '#94a3b8' },
            { label: t('nutrition.vitaminC'), current: tVitC, target: targets.vitaminC, unit: 'mg', color: '#f97316' },
            { label: t('nutrition.vitaminA'), current: tVitA, target: targets.vitaminA, unit: 'mcg', color: '#fbbf24' },
            { label: t('nutrition.vitaminD'), current: tVitD, target: targets.vitaminD, unit: 'IU', color: '#fde68a' },
            { label: t('nutrition.vitaminB12'), current: tVitB12, target: targets.vitaminB12, unit: 'mcg', color: '#e879f9' },
            { label: t('nutrition.magnesium'), current: tMag, target: targets.magnesium, unit: 'mg', color: '#34d399' },
            { label: t('nutrition.zinc'), current: tZinc, target: targets.zinc, unit: 'mg', color: '#38bdf8' },
            { label: t('nutrition.phosphorus'), current: tPhos, target: targets.phosphorus, unit: 'mg', color: '#c084fc' },
            { label: t('nutrition.vitaminE'), current: tVitE, target: targets.vitaminE, unit: 'mg', color: '#facc15' },
            { label: t('nutrition.vitaminK'), current: tVitK, target: targets.vitaminK, unit: 'mcg', color: '#4ade80' },
            { label: t('nutrition.vitaminB6'), current: tVitB6, target: targets.vitaminB6, unit: 'mg', color: '#f472b6' },
            { label: t('nutrition.folate'), current: tFolate, target: targets.folate, unit: 'mcg', color: '#fb7185' },
          ];
          return (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {microRows.map(({ label, current, target, unit, color }) => {
                const pct = Math.min(100, (current / Math.max(1, target)) * 100);
                const over = pct >= 100;
                const displayColor = over ? 'var(--color-warning)' : color;
                // Always show 1 decimal place: small mg values (zinc, vitamin E/B6)
                // are frequently under 1 and would otherwise round to a
                // misleading "0" even when the food contributed a real amount.
                const displayVal = current.toFixed(1);
                const targetVal = Number(target).toFixed(1);
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: displayColor }}>
                        {displayVal}<span style={{ opacity: 0.6 }}>{unit}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> / {targetVal}{unit}</span>
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 999,
                        background: displayColor,
                        transition: 'width 0.6s var(--ease-out)',
                        boxShadow: `0 0 6px ${displayColor}66`
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Water */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <WaterSection
          current={todayLog.waterMl}
          target={targets.water}
          onAdd={(ml) => addWater(selectedDate, ml)}
          onReset={() => window.confirm('Reset water intake to 0?') && resetWater(todayLog.date)}
        />
      </div>

      {/* Food Search + Add */}
      <div className="animate-fade-up" style={{ marginBottom: '1.25rem' }}>
        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('nutrition.log_food')}</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {/* AI Scan Button */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAiScan} style={{ display: 'none' }} />
            <button data-walkthrough="scan-button" onClick={() => fileInputRef.current?.click()} disabled={aiScanning} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
              background: 'linear-gradient(135deg, var(--cyan), var(--magenta))', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              boxShadow: '0 0 10px rgba(0,240,255,0.3)', transition: 'all 0.2s'
            }}>
              {aiScanning ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
              {aiScanning ? t('common.loading') : t('nutrition.ai_scan_button')}
            </button>

            {/* Barcode Scanner Button */}
            <button data-walkthrough="barcode-button" onClick={showBarcodeScanner ? stopBarcodeScanner : startBarcodeScanner} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
              background: showBarcodeScanner ? 'rgba(255,0,85,0.15)' : 'rgba(255,170,0,0.12)',
              color: showBarcodeScanner ? 'var(--magenta)' : 'var(--gold)',
              border: `1px solid ${showBarcodeScanner ? 'rgba(255,0,85,0.3)' : 'rgba(255,170,0,0.3)'}`,
              borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s'
            }}>
              {showBarcodeScanner ? <X size={14} /> : <Sparkles size={14} />}
              {showBarcodeScanner ? t('nutrition.stop_scan') : t('nutrition.scan_barcode')}
            </button>

            {/* Add Custom Food Trigger */}
            <button onClick={() => setShowAddCustomFood(!showAddCustomFood)} style={{
              display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 600,
              background: 'rgba(255,170,0,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,170,0,0.3)', borderRadius: 8, cursor: 'pointer'
            }}>
              <Plus size={12} /> {t('common.add')}
            </button>
          </div>
        </div>

        {/* Custom Food Creation Form */}
        {showAddCustomFood && (
          <div className="glass-card animate-fade-in" style={{ padding: '1.25rem', marginBottom: '1rem', border: '1px solid var(--gold)' }}>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>{t('nutrition.log_food')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input type="text" placeholder={t('auth.name')} value={newCustomFood.name}
                onChange={e => setNewCustomFood({ ...newCustomFood, name: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff' }} />
              <input type="text" placeholder={t('nutrition.name_arabic')} value={newCustomFood.nameAr}
                onChange={e => setNewCustomFood({ ...newCustomFood, nameAr: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{t('dash.calories')}</label>
                <input type="number" value={newCustomFood.calories} onChange={e => setNewCustomFood({ ...newCustomFood, calories: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{t('dash.protein')} (g)</label>
                <input type="number" value={newCustomFood.protein} onChange={e => setNewCustomFood({ ...newCustomFood, protein: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{t('nutrition.carbs')} (g)</label>
                <input type="number" value={newCustomFood.carbs} onChange={e => setNewCustomFood({ ...newCustomFood, carbs: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.15rem' }}>{t('nutrition.fats')} (g)</label>
                <input type="number" value={newCustomFood.fats} onChange={e => setNewCustomFood({ ...newCustomFood, fats: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem', textAlign: 'center' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <select value={newCustomFood.category} onChange={e => setNewCustomFood({ ...newCustomFood, category: e.target.value })} style={{ fontSize: '0.8rem' }}>
                <option value="Protein">{t('nutrition.cat_protein')}</option>
                <option value="Dairy">{t('nutrition.cat_dairy')}</option>
                <option value="Supermarket">{t('nutrition.cat_supermarket')}</option>
                <option value="Fruit">{t('nutrition.cat_fruit')}</option>
                <option value="Cooked">{t('nutrition.cat_cooked')}</option>
              </select>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <input type="number" placeholder={t('nutrition.serving_size')} value={newCustomFood.servingSize} onChange={e => setNewCustomFood({ ...newCustomFood, servingSize: parseInt(e.target.value) || 100 })}
                  style={{ flex: 1, padding: '0.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem' }} />
                <input type="text" placeholder={t('nutrition.serving_unit')} value={newCustomFood.servingUnit} onChange={e => setNewCustomFood({ ...newCustomFood, servingUnit: e.target.value })}
                  style={{ width: '45px', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.8rem', textAlign: 'center' }} />
              </div>
            </div>
            <button className="btn-primary" onClick={handleCreateCustomFood} style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}>{t('common.save')}</button>
          </div>
        )}

        {/* Barcode Scanner Container */}
        {showBarcodeScanner && (
          <div style={{ marginBottom: '1rem', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--gold)', background: '#000' }}>
            <div id="barcode-reader-container" style={{ width: '100%', minHeight: 200 }} />
            <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t('nutrition.scan_barcode')} — {t('nutrition.stop_scan')}
            </div>
          </div>
        )}

        {barcodeLookupLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', marginBottom: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            <Loader2 className="animate-spin" size={16} /> {t('nutrition.barcode_looking_up')}
          </div>
        )}

        {!barcodeLookupLoading && offScanResult && (
          <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--cyan)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              {t('nutrition.barcode_found_online')}
            </div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{offScanResult.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              {offScanResult.calories}kcal · P:{offScanResult.protein}g · C:{offScanResult.carbs}g · F:{offScanResult.fats}g ({t('nutrition.per_100g')})
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                onClick={() => { handleAdd(offScanResult, offScanResult.servingSize); setOffScanResult(null); }}>
                {t('nutrition.log_this_meal_now')}
              </button>
              <button className="btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setOffScanResult(null)}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <RecipesSection mealType={mealType} onLogged={() => { addXP(2); }} />

        {/* Search Bars */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setSearchTab('all')} style={{
            flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600,
            background: searchTab === 'all' ? 'rgba(0,240,255,0.1)' : 'transparent',
            color: searchTab === 'all' ? 'var(--cyan)' : 'var(--color-text-muted)',
            border: `1px solid ${searchTab === 'all' ? 'rgba(0,240,255,0.3)' : 'transparent'}`,
            borderRadius: 8, transition: '0.2s'
          }}>{t('nutrition.tab_all')}</button>
          <button onClick={() => setSearchTab('raw')} style={{
            flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600,
            background: searchTab === 'raw' ? 'rgba(0,255,136,0.1)' : 'transparent',
            color: searchTab === 'raw' ? 'var(--color-success)' : 'var(--color-text-muted)',
            border: `1px solid ${searchTab === 'raw' ? 'rgba(0,255,136,0.3)' : 'transparent'}`,
            borderRadius: 8, transition: '0.2s'
          }}>{t('nutrition.tab_raw')}</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <select value={mealType} onChange={e => setMealType(e.target.value)} style={{ width: '45%' }}>
            {MEAL_TYPE_KEYS.map(key => <option key={key} value={key}>{MEAL_TYPE_LABELS[key]}</option>)}
          </select>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', insetInlineStart: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder={t('nutrition.search')} value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingInlineStart: '2.25rem' }}
            />
          </div>
        </div>

        {filtered.length > 0 && (
          <div className="glass-card" style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 'var(--radius-md)' }}>
            {filtered.map(f => <FoodResultRow key={f.id} food={f} onAdd={handleAdd} />)}
          </div>
        )}
      </div>

      {/* AI Food Scan Success Modal */}
      {showAiResultModal && aiScanResult && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-card animate-scale-up" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', border: '1px solid var(--cyan)', position: 'relative' }}>
            <button onClick={() => setShowAiResultModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Sparkles size={18} color="var(--cyan)" />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--cyan)', margin: 0 }}>{t('nutrition.ai_scan_title')}</h3>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>{useLanguageStore.getState().lang === 'ar' ? aiScanResult.nameAr : aiScanResult.name}</h4>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--magenta)', border: '1px solid var(--magenta)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                {aiScanResult.category}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)' }}>{aiScanResult.calories}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)' }}>{t('nutrition.calories_short')}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-success)' }}>{aiScanResult.protein}g</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)' }}>{t('nutrition.protein_short')}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-warning)' }}>{aiScanResult.carbs}g</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)' }}>{t('nutrition.carbs_short')}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--magenta)' }}>{aiScanResult.fats}g</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)' }}>{t('nutrition.fats_short')}</div>
                </div>
              </div>
            </div>

            {aiScanResult.analysis && (
              <div style={{ padding: '0.75rem', background: 'rgba(0,240,255,0.04)', borderLeft: '3px solid var(--cyan)', borderRadius: '0 8px 8px 0', fontSize: '0.78rem', lineHeight: 1.4, color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                💡 <strong>{t('nutrition.coach_note')}:</strong> {aiScanResult.analysis}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('nutrition.add_to_meal')}:</span>
                <select value={mealType} onChange={e => setMealType(e.target.value)} style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>
                  {MEAL_TYPE_KEYS.map(key => <option key={key} value={key}>{MEAL_TYPE_LABELS[key]}</option>)}
                </select>
              </div>
              <button className="btn-primary" onClick={() => {
                const scannedFood: Food = {
                  id: 'scan_' + Date.now(),
                  name: aiScanResult.name,
                  nameAr: aiScanResult.nameAr,
                  category: aiScanResult.category,
                  calories: aiScanResult.calories,
                  protein: aiScanResult.protein,
                  carbs: aiScanResult.carbs,
                  fats: aiScanResult.fats,
                  fiber: aiScanResult.fiber,
                  sodium: aiScanResult.sodium,
                  potassium: aiScanResult.potassium,
                  servingSize: aiScanResult.servingSize || 100,
                  servingUnit: aiScanResult.servingUnit || 'g'
                };
                handleAdd(scannedFood, aiScanResult.servingSize || 100);
                setShowAiResultModal(false);
              }} style={{ width: '100%', padding: '0.75rem' }}>{t('nutrition.log_this_meal_now')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Meal Logs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="section-label">{t('nutrition.meals')}</div>
        {MEAL_TYPE_KEYS.map(typeKey => {
          const meal = todayLog.meals.find(m => m.type === typeKey);
          if (!meal || meal.foods.length === 0) return null;
          const isOpen = openMeals[typeKey] !== false;
          const mealCal = meal.foods.reduce((a, f) => a + f.calories, 0);
          const typeLabel = MEAL_TYPE_LABELS[typeKey] || typeKey;
          return (
            <div key={typeKey} className="glass-card" style={{ marginBottom: '0.75rem' }}>
              <button onClick={() => toggleMeal(typeKey)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1rem 1.25rem', color: 'var(--color-text)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{typeLabel}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan)' }}>{Math.round(mealCal)} kcal</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{meal.foods.length} {t('common.items')}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Reset ${typeLabel}?`)) resetMeal(todayLog.date, typeKey);
                    }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,0,0,0.6)', padding: '0 0.25rem', display: 'flex' }}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <ChevronDown size={16} color="var(--color-text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 1.25rem 1rem' }}>
                  {meal.foods.map((food, fi) => {
                    const loggedName = useLanguageStore.getState().lang === 'ar' && food.nameAr ? food.nameAr : food.name;
                    return (
                      <div key={fi} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.6rem 0',
                        borderTop: '1px solid rgba(0,240,255,0.07)',
                      }}>
                        <div style={{ flex: 1, paddingInlineEnd: '0.5rem' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.15rem' }}>{loggedName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                            {food.amount}{food.unit} · {food.calories}kcal
                          </div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                            P:{Math.round(food.protein)}g · C:{Math.round(food.carbs)}g · F:{Math.round(food.fats)}g
                          </div>
                        </div>
                        <button
                          onClick={() => removeFood(todayLog.date, meal.id, food.foodId)}
                          style={{ background: 'rgba(255,0,80,0.1)', border: '1px solid rgba(255,0,80,0.25)', borderRadius: 6, padding: '0.35rem', display: 'flex', color: 'rgba(255,0,110,0.8)', flexShrink: 0 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Supplements */}
      <Supplements
        todayLog={todayLog}
        onReset={() => window.confirm('Reset today\'s supplements?') && resetSupplements(todayLog.date)}
      />
    </div>
  );
};

export default Nutrition;