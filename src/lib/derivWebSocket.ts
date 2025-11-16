/**
 * Deriv WebSocket Service - Handles all API communications
 * Endpoint: wss://ws.derivws.com/websockets/v3?app_id=1089
 */

export interface DerivMessage {
  [key: string]: any;
}

export class DerivWebSocket {
  private ws: WebSocket | null = null;
  private apiToken: string = '';
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private requestId: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle incoming messages
    this.onMessage = this.onMessage.bind(this);
  }

  connect(apiToken: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.apiToken = apiToken;
      
      // Use public app_id 1089 for testing/production
      const wsUrl = 'wss://ws.derivws.com/websockets/v3?app_id=1089';
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to Deriv API');
        this.reconnectAttempts = 0;
        
        // Authorize with token
        this.send({
          authorize: apiToken,
        }).then(resolve).catch(reject);
      };
      
      this.ws.onmessage = (event) => {
        this.onMessage(JSON.parse(event.data));
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('🔌 Disconnected from Deriv API');
        this.handleReconnect();
      };
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.apiToken) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.connect(this.apiToken);
      }, this.reconnectDelay);
    }
  }

  private onMessage(data: DerivMessage) {
    console.log('📨 Received:', data.msg_type);
    
    // Handle specific message types
    if (data.msg_type) {
      const handler = this.messageHandlers.get(data.msg_type);
      if (handler) {
        handler(data);
      }
    }
    
    // Handle req_id based responses
    if (data.req_id) {
      const handler = this.messageHandlers.get(`req_${data.req_id}`);
      if (handler) {
        handler(data);
        this.messageHandlers.delete(`req_${data.req_id}`);
      }
    }
  }

  send(message: DerivMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.requestId++;
      const req_id = this.requestId;
      message.req_id = req_id;

      // Set up one-time response handler
      this.messageHandlers.set(`req_${req_id}`, (data) => {
        if (data.error) {
          reject(data.error);
        } else {
          resolve(data);
        }
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  subscribe(msgType: string, handler: (data: any) => void) {
    this.messageHandlers.set(msgType, handler);
  }

  unsubscribe(msgType: string) {
    this.messageHandlers.delete(msgType);
  }

  // API Methods
  async getBalance() {
    return this.send({ balance: 1, subscribe: 1 });
  }

  async getAccountInfo() {
    return this.send({ get_account_status: 1 });
  }

  async getTicks(symbol: string) {
    return this.send({ 
      ticks: symbol, 
      subscribe: 1 
    });
  }

  async getCandles(symbol: string, granularity: number = 60) {
    return this.send({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 100,
      end: 'latest',
      start: 1,
      style: 'candles',
      granularity: granularity,
    });
  }

  async buyContract(params: {
    amount: number;
    basis: string;
    contract_type: string;
    currency: string;
    duration: number;
    duration_unit: string;
    symbol: string;
    barrier?: string;
    barrier2?: string;
  }) {
    return this.send({
      buy: 1,
      price: params.amount,
      parameters: params,
      subscribe: 1,
    });
  }

  async getActiveSymbols() {
    return this.send({
      active_symbols: 'brief',
      product_type: 'basic',
    });
  }

  async getContractTypes(symbol: string) {
    return this.send({
      contracts_for: symbol,
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const derivAPI = new DerivWebSocket();
