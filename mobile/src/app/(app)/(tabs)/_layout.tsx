import { Tabs } from "expo-router/js-tabs";
import { useMe } from "@/auth/session";
import { FloatingTabBar } from "@/components/tab-bar";

/**
 * Home · WIP · Pipeline · Follow-ups · More, as in the prototype. Pipeline (the company's deal board) is for
 * owners and admins; employees see their own WIP on Home and in WIP.
 */
export default function TabsLayout() {
  const me = useMe();
  const hidden = me.user.role === "EMPLOYEE" ? ["pipeline"] : [];
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }} tabBar={(props) => <FloatingTabBar {...props} hidden={hidden} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wip" />
      <Tabs.Screen name="pipeline" />
      <Tabs.Screen name="follow-ups" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
