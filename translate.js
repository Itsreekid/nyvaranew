const fs = require('fs');
let file = fs.readFileSync('client/src/app/shop/[id]/ProductDetail.tsx', 'utf8');

// 1. Add imports
if (!file.includes('useLanguage')) {
  file = file.replace("import { useRouter } from 'next/navigation';", "import { useRouter } from 'next/navigation';\nimport { useLanguage } from '@/context/LanguageContext';\nimport { getTranslation } from '@/locales/dictionary';");
}

// 2. Add hook
if (!file.includes('const { language } = useLanguage()')) {
  file = file.replace('const router = useRouter();', "const router = useRouter();\n  const { language } = useLanguage();\n  const t = (path: string) => getTranslation(language, path);");
}

// 3. Replace text
file = file.replace(/> Retour à la boutique/g, '> {t(\'common.backToShop\')}');
file = file.replace(/>LIVRAISON GRATUITE</g, '>{t(\'common.freeShipping\')}<');
file = file.replace(/Couleur : <strong/g, '{t(\'product.color\')} <strong');
file = file.replace(/Veuillez choisir/g, '{t(\'product.chooseColor\')}');
file = file.replace(/'Veuillez choisir une couleur pour continuer'/g, "t('product.chooseColorError')");
file = file.replace(/Économisez /g, "{t('product.save')} ");
file = file.replace(/Paiement Sécurisé/g, "{t('product.securePayment')}");
file = file.replace(/Livraison à domicile/g, "{t('product.homeDelivery')}");
file = file.replace(/Retours 30 jours/g, "{t('product.returns')}");
file = file.replace(/Satisfaction garantie/g, "{t('product.satisfaction')}");
file = file.replace(/Livraison Gratuite/g, "{t('product.freeDelivery')}");
file = file.replace(/>Partout en Tunisie</g, ">{t('product.allTunisia')}<");
file = file.replace(/Anti-Rayures/g, "{t('product.antiScratch')}");
file = file.replace(/Anti-Reflets HD/g, "{t('product.antiGlare')}");
file = file.replace(/Lentilles Polarisées/g, "{t('product.polarized')}");
file = file.replace(/Protection UV400/g, "{t('product.uv400')}");
file = file.replace(/>Caractéristiques techniques</g, ">{t('product.specsTitle')}<");
file = file.replace(/>Matériau de la monture</g, ">{t('product.material')}<");
file = file.replace(/>Type de verres</g, ">{t('product.lensType')}<");
file = file.replace(/>Charnières</g, ">{t('product.hinges')}<");
file = file.replace(/>Largeur du pont</g, ">{t('product.bridge')}<");
file = file.replace(/>Longueur des branches</g, ">{t('product.temples')}<");
file = file.replace(/>Clairs \(possibilité de verres correcteurs\)</g, ">{t('product.clearLenses')}<");
file = file.replace(/>Renforcées</g, ">{t('product.reinforced')}<");
file = file.replace(/À propos de ce produit/g, "{t('product.descriptionTitle')}");
file = file.replace(/Vous aimerez aussi/g, "{t('product.relatedTitle')}");
file = file.replace(/Passer commande/g, "{t('product.buyNow')}");
file = file.replace(/Ajouter au panier/g, "{t('product.addToCart')}");
file = file.replace(/Quantité :/g, "{t('product.qty')}");
file = file.replace(/> En stock</g, "> {t('product.inStock')}<");
file = file.replace(/'✗ Indisponible'/g, "t('product.unavailable')");
file = file.replace(/'✗ Rupture de stock'/g, "t('product.outOfStock')");
file = file.replace(/Offres spéciales :/g, "{t('product.specialOffers')}");
file = file.replace(/Prix standard/g, "{t('product.standardPrice')}");
file = file.replace(/1 unité/g, "1 {t('product.unit')}");
file = file.replace(/unités/g, "{t('product.units')}");
file = file.replace(/>Paire/g, ">{t('product.pair')}");
file = file.replace(/avis\)/g, "{t('product.reviews')})");

fs.writeFileSync('client/src/app/shop/[id]/ProductDetail.tsx', file);
console.log('ProductDetail.tsx updated!');
