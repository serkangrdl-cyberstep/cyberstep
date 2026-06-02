import { logger } from "../lib/logger";

function getBaseUrl(): string {
  // Production URL when real API keys are configured, sandbox otherwise
  const apiKey = process.env["IYZICO_API_KEY"] ?? "";
  return apiKey && apiKey !== "sandbox" ? "https://api.iyzipay.com" : "https://sandbox-api.iyzipay.com";
}

export function isIyzicoConfigured(): boolean {
  return !!(process.env["IYZICO_API_KEY"] && process.env["IYZICO_SECRET_KEY"]);
}

function getCredentials() {
  return {
    apiKey: process.env["IYZICO_API_KEY"] ?? "",
    secretKey: process.env["IYZICO_SECRET_KEY"] ?? "",
  };
}

import { createHmac, randomBytes } from "crypto";

function generateAuthString(apiKey: string, secretKey: string, randomStr: string, body: string): string {
  const hash = createHmac("sha1", secretKey)
    .update(apiKey + randomStr + body)
    .digest("base64");
  return `IYZWS ${apiKey}:${hash}`;
}

export interface IyzicoPaymentRequest {
  price: string;
  paidPrice: string;
  currency: string;
  installment: number;
  paymentCard: {
    cardHolderName: string;
    cardNumber: string;
    expireYear: string;
    expireMonth: string;
    cvc: string;
    registerCard?: number;
    cardUserKey?: string;
  };
  buyer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    identityNumber: string;
    registrationAddress: string;
    city: string;
    country: string;
    ip: string;
  };
  shippingAddress: {
    address: string;
    city: string;
    country: string;
    contactName: string;
  };
  billingAddress: {
    address: string;
    city: string;
    country: string;
    contactName: string;
  };
  basketItems: Array<{
    id: string;
    name: string;
    category1: string;
    itemType: string;
    price: string;
  }>;
  conversationId: string;
}

export interface IyzicoStoredCardRequest {
  price: string;
  paidPrice: string;
  currency: string;
  installment: number;
  paymentCard: {
    cardUserKey: string;
    cardToken: string;
  };
  buyer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    identityNumber: string;
    registrationAddress: string;
    city: string;
    country: string;
    ip: string;
  };
  shippingAddress: { address: string; city: string; country: string; contactName: string };
  billingAddress: { address: string; city: string; country: string; contactName: string };
  basketItems: Array<{ id: string; name: string; category1: string; itemType: string; price: string }>;
  conversationId: string;
}

export async function createPayment(req: IyzicoPaymentRequest): Promise<{
  success: boolean;
  paymentId?: string;
  errorMessage?: string;
  conversationId: string;
  cardUserKey?: string;
  cardToken?: string;
}> {
  const { apiKey, secretKey } = getCredentials();
  if (!apiKey || !secretKey) {
    return { success: false, errorMessage: "İyzico API anahtarları yapılandırılmamış", conversationId: req.conversationId };
  }

  const randomStr = randomBytes(8).toString("hex");
  const body = JSON.stringify({ ...req, locale: "tr" });

  try {
    const response = await fetch(`${getBaseUrl()}/payment/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": generateAuthString(apiKey, secretKey, randomStr, body),
        "x-iyzi-rnd": randomStr,
        "x-iyzi-client-version": "iyzipay-node-2.0.50",
      },
      body,
    });

    const data = await response.json() as {
      status: string;
      paymentId?: string;
      errorMessage?: string;
      conversationId: string;
      cardUserKey?: string;
      cardDetails?: { cardUserKey?: string; cardToken?: string } | null;
    };

    if (data.status === "success") {
      const cardUserKey = data.cardUserKey ?? data.cardDetails?.cardUserKey;
      const cardToken = data.cardDetails?.cardToken;
      return { success: true, paymentId: data.paymentId, conversationId: data.conversationId, cardUserKey, cardToken };
    }
    return { success: false, errorMessage: data.errorMessage ?? "Ödeme başarısız", conversationId: data.conversationId };
  } catch (err) {
    logger.error({ err }, "Iyzico payment error");
    return { success: false, errorMessage: "Ödeme servisi ile bağlantı kurulamadı", conversationId: req.conversationId };
  }
}

export async function createPaymentWithStoredCard(req: IyzicoStoredCardRequest): Promise<{
  success: boolean;
  paymentId?: string;
  errorMessage?: string;
  conversationId: string;
}> {
  const { apiKey, secretKey } = getCredentials();
  if (!apiKey || !secretKey) {
    return { success: false, errorMessage: "İyzico API anahtarları yapılandırılmamış", conversationId: req.conversationId };
  }

  const randomStr = randomBytes(8).toString("hex");
  const body = JSON.stringify({ ...req, locale: "tr" });

  try {
    const response = await fetch(`${getBaseUrl()}/payment/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": generateAuthString(apiKey, secretKey, randomStr, body),
        "x-iyzi-rnd": randomStr,
        "x-iyzi-client-version": "iyzipay-node-2.0.50",
      },
      body,
    });

    const data = await response.json() as { status: string; paymentId?: string; errorMessage?: string; conversationId: string };

    if (data.status === "success") {
      return { success: true, paymentId: data.paymentId, conversationId: data.conversationId };
    }
    return { success: false, errorMessage: data.errorMessage ?? "Ödeme başarısız (kayıtlı kart)", conversationId: data.conversationId };
  } catch (err) {
    logger.error({ err }, "Iyzico stored-card payment error");
    return { success: false, errorMessage: "Ödeme servisi ile bağlantı kurulamadı", conversationId: req.conversationId };
  }
}

export async function checkPayment(paymentId: string): Promise<{ success: boolean; status?: string }> {
  const { apiKey, secretKey } = getCredentials();
  const randomStr = randomBytes(8).toString("hex");
  const body = JSON.stringify({ locale: "tr", paymentId });

  try {
    const response = await fetch(`${getBaseUrl()}/payment/detail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": generateAuthString(apiKey, secretKey, randomStr, body),
        "x-iyzi-rnd": randomStr,
        "x-iyzi-client-version": "iyzipay-node-2.0.50",
      },
      body,
    });
    const data = await response.json() as { status: string };
    return { success: data.status === "success", status: data.status };
  } catch {
    return { success: false };
  }
}
