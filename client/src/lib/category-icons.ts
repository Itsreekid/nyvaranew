import {
  LayoutGrid, Glasses, Sun, Watch, Gem, Wallet, ShoppingBag, Footprints,
  Shirt, Paintbrush, FlaskConical, Gift, KeyRound, Backpack, Umbrella,
  Headphones, Smartphone, Palette, Ribbon, createLucideIcon,
} from 'lucide-react';

const BaseballCap = createLucideIcon('BaseballCap', [
  ['path', { d: 'M3 15.5v-2a7.5 7.5 0 0 1 15 0v1.2', key: 'crown' }],
  ['path', { d: 'M6.5 15.2c1.1-5.3 3-8.2 5.6-9', key: 'seam' }],
  ['path', { d: 'M3 15.5c3-.6 5.7-.5 8.3.3 3-.9 5.6-1.3 7.5-1.1 1.6.2 2.5 1 2.5 1.8 0 1.1-1.6 1.9-3.9 1.9-2.1 0-4.5-.8-6.2-1.8-2.6.8-5.6.9-8.2.4z', key: 'visor' }],
]);

export const categoryIcons = {
  general: { label: 'Général', icon: LayoutGrid },
  eyewear: { label: 'Lunettes de vue', icon: Glasses },
  sunglasses: { label: 'Lunettes solaires', icon: Sun },
  watch: { label: 'Montres', icon: Watch },
  jewelry: { label: 'Bijoux', icon: Gem },
  hat: { label: 'Chapeaux et casquettes', icon: BaseballCap },
  wallet: { label: 'Portefeuilles', icon: Wallet },
  bag: { label: 'Sacs', icon: ShoppingBag },
  backpack: { label: 'Sacs à dos', icon: Backpack },
  shoes: { label: 'Chaussures', icon: Footprints },
  clothing: { label: 'Vêtements', icon: Shirt },
  cosmetics: { label: 'Cosmétiques et beauté', icon: Paintbrush },
  perfume: { label: 'Parfums', icon: FlaskConical },
  gift: { label: 'Cadeaux', icon: Gift },
  accessories: { label: 'Accessoires', icon: KeyRound },
  scarf: { label: 'Foulards et écharpes', icon: Ribbon },
  umbrella: { label: 'Parapluies', icon: Umbrella },
  audio: { label: 'Audio et écouteurs', icon: Headphones },
  tech: { label: 'Gadgets et téléphones', icon: Smartphone },
  creative: { label: 'Création et couleurs', icon: Palette },
};

export type CategoryIconId = keyof typeof categoryIcons;
export type CategoryHomepageConfig = { icon: CategoryIconId; visible: boolean | null; order: number };

export const defaultCategoryConfig: CategoryHomepageConfig = { icon: 'general', visible: null, order: 0 };

export function readCategoryConfig(value: unknown): CategoryHomepageConfig {
  const config = (value && typeof value === 'object' ? value : {}) as Partial<CategoryHomepageConfig>;
  return {
    icon: config.icon && Object.hasOwn(categoryIcons, config.icon) ? config.icon : 'general',
    visible: typeof config.visible === 'boolean' ? config.visible : null,
    order: typeof config.order === 'number' && Number.isSafeInteger(config.order)
      && config.order >= 0 && config.order <= 9999 ? config.order : 0,
  };
}
