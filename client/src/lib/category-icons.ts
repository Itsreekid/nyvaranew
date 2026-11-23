import {
  LayoutGrid, Glasses, Sun, Watch, Gem, Crown, Wallet, ShoppingBag, Footprints,
  Shirt, Paintbrush, FlaskConical, Gift, KeyRound, Backpack, Umbrella,
  Headphones, Smartphone, Palette, Ribbon,
} from 'lucide-react';

export const categoryIcons = {
  general: { label: 'Général', icon: LayoutGrid },
  eyewear: { label: 'Lunettes de vue', icon: Glasses },
  sunglasses: { label: 'Lunettes solaires', icon: Sun },
  watch: { label: 'Montres', icon: Watch },
  jewelry: { label: 'Bijoux', icon: Gem },
  hat: { label: 'Chapeaux et casquettes', icon: Crown },
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
