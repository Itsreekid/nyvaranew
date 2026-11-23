import CategoryManager from '@/components/admin/CategoryManager';
import adminStyles from '../admin.module.css';

export default function AdminCategoriesPage() {
  return (
    <>
      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Catégories</h1>
      </div>
      <CategoryManager />
    </>
  );
}
