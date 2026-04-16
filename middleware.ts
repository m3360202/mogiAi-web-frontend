import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
 
export default createMiddleware(routing);
 
export const config = {
  // Match only internationalized pathnames
  // Include lowercase variants as some environments normalize locales in the URL/cookie.
  matcher: ['/', '/(zh-CN|zh-cn|ja|en)/:path*']
};
