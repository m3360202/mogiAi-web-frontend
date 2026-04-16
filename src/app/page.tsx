import {redirect} from 'next/navigation';

// Redirect to default locale
export default function RootPage() {
  redirect('/zh-CN');
}
