import { logger } from "../lib/logger";

export interface EInvoiceParams {
  customerEmail: string;
  customerName: string;
  companyName: string;
  taxNumber?: string;
  amount: number;
  kdv: number;
  total: number;
  serviceLabel: string;
  paymentRef: string;
}

export async function createEInvoice(params: EInvoiceParams): Promise<{ invoiceNo: string; pdfUrl: string } | null> {
  const apiKey = process.env["PARASUT_API_KEY"];
  const clientId = process.env["PARASUT_CLIENT_ID"];
  const clientSecret = process.env["PARASUT_CLIENT_SECRET"];
  const companyId = process.env["PARASUT_COMPANY_ID"];

  if (!apiKey || !clientId || !clientSecret || !companyId) {
    logger.warn({ customerEmail: params.customerEmail }, "PARASUT env vars eksik — e-fatura atlandı");
    return null;
  }

  try {
    const { default: axios } = await import("axios");

    const tokenResp = await axios.post<{ access_token: string }>(
      "https://api.parasut.com/oauth/token",
      {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      },
      { timeout: 10000 }
    );
    const token = tokenResp.data.access_token;

    const issueDate = new Date().toISOString().split("T")[0]!;
    const itemType = params.taxNumber ? "e_invoice" : "e_archive";

    const invoiceResp = await axios.post<{
      data: {
        id: string;
        attributes: { invoice_no: string; pdf_url: string };
      };
    }>(
      `https://api.parasut.com/v4/${companyId}/sales_invoices`,
      {
        data: {
          type: "SalesInvoice",
          attributes: {
            item_type: itemType,
            description: params.serviceLabel,
            issue_date: issueDate,
            due_date: issueDate,
            currency: "TRY",
          },
          relationships: {
            contact: {
              data: {
                type: "Contact",
                attributes: {
                  name: params.companyName || params.customerName,
                  email: params.customerEmail,
                  tax_number: params.taxNumber ?? null,
                  account_type: "customer",
                },
              },
            },
            details: {
              data: [
                {
                  type: "SalesInvoiceDetail",
                  attributes: {
                    description: params.serviceLabel,
                    quantity: "1.0",
                    unit_price: String(params.amount),
                    vat_rate: 20,
                  },
                },
              ],
            },
          },
        },
      },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.api+json" }, timeout: 15000 }
    );

    const invoiceNo = invoiceResp.data.data.attributes.invoice_no;
    const pdfUrl = invoiceResp.data.data.attributes.pdf_url;

    logger.info({ invoiceNo, customerEmail: params.customerEmail, serviceLabel: params.serviceLabel }, "E-fatura oluşturuldu");
    return { invoiceNo, pdfUrl };
  } catch (err) {
    logger.error({ err, customerEmail: params.customerEmail }, "E-fatura oluşturma hatası — satış devam ediyor");
    return null;
  }
}
