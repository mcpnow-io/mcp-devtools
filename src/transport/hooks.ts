import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export type Hooks = {
  onBeforeCreate?: (options: any) => void;
  onCreated?: (transport: Transport) => void;
  onBeforeSendMessage?: (message: JSONRPCMessage, options?: TransportSendOptions) => void;
  onAfterSendMessage?: (message: JSONRPCMessage, options?: TransportSendOptions) => void;
  onReceiveMessage?: (message: JSONRPCMessage) => void;
  onStart?: () => void;
  onAfterStart?: () => void;
  onClose?: () => void;
  onAfterClose?: () => void;
  onError?: (error: Error) => void;
  onWarning?: (message: string) => void;
  onSetProtocolVersion?: (beforeVersion: string, afterVersion: string) => void;
};
