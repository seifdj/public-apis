import { Redirect } from 'expo-router';

/** Step 1: the app opens on the component gallery. Step 2 replaces this with the auth gate. */
export default function Index() {
  return <Redirect href="/(gallery)/components" />;
}
