import { ItemScreen } from '@/components/item-screen';
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemScreen key={id} id={id} />;
}
