import { EventEmitter, NativeModule, requireNativeModule } from 'expo-modules-core';

export type NotificationEvent = {
  title: string;
  text: string;
  packageName: string;
  timestamp: number;
};

type Events = {
  onNotificationReceived: (event: NotificationEvent) => void;
};

declare class NotificationListenerNativeModule extends NativeModule<Events> {
  isNotificationServiceEnabled(): boolean;
  openNotificationSettings(): void;
}

const listenerModule =
  requireNativeModule<NotificationListenerNativeModule>('NotificationListener');
const emitter = new EventEmitter(listenerModule);

export function isNotificationServiceEnabled(): boolean {
  return listenerModule.isNotificationServiceEnabled();
}

export function openNotificationSettings(): void {
  listenerModule.openNotificationSettings();
}

export function addNotificationListener(
  listener: (event: NotificationEvent) => void
) {
  return emitter.addListener('onNotificationReceived', listener);
}
