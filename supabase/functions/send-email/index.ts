import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = "re_6H9Qq4rL_8U485mAfZTUddFSV37v2319g";
const resend = new Resend(RESEND_API_KEY);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { type, data } = payload
    
    // Default fallback
    let to = payload.to || 'iarejyero@gmail.com';
    let subject = 'Sistema Norvexis Core';
    let html = '<p>Mensaje automático del sistema.</p>';

    if (type === 'schedule_change') {
       subject = `[Norvexis] Actualización en su horario de trabajo`;
       html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #4f46e5;">Actualización de Horario</h2>
            <p>Hola,</p>
            <p>Se han realizado cambios en su horario asignado. Por favor, revise la plataforma de Norvexis Core para más detalles.</p>
            <p style="color: #666; font-size: 12px; margin-top: 40px;">Este es un mensaje automático generado por el sistema.</p>
        </div>
       `;
    } else if (type === 'inventory_alert') {
       subject = `[Norvexis] ALERTA DE STOCK: ${data.name}`;
       html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #dc2626;">Alerta de Inventario (Bajo Mínimo)</h2>
            <p>El siguiente producto ha caído a un nivel de inventario que requiere atención:</p>
            <ul>
                <li><strong>Producto:</strong> ${data.name}</li>
                <li><strong>Stock Actual:</strong> <span style="color:#dc2626; font-weight:bold;">${data.stock}</span></li>
                <li><strong>Mínimo Configurado:</strong> ${data.minStock}</li>
                <li><strong>Sucursal ID:</strong> ${data.location_id || 'Principal'}</li>
            </ul>
        </div>
       `;
    } else if (type === 'expiry_alert') {
       subject = `[Norvexis] ALERTA DE CADUCIDAD: Productos por vencer`;
       const itemsHtml = data.items.map((i: any) => `<li><strong>${i.name}</strong> - Expira el: ${i.expiryDate} (Quedan ${i.stock} unidades)</li>`).join('');
       html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #eab308;">Alerta de Caducidad (30 Días)</h2>
            <p>Los siguientes lotes de inventario expiran en 30 días o menos:</p>
            <ul>${itemsHtml}</ul>
            <p>Por favor, asegúrese de utilizarlos o reubicarlos según el protocolo del inventario.</p>
        </div>
       `;
    } else if (type === 'test') {
       subject = '[Norvexis] Prueba de Integración Exitosa';
       html = `<div style="font-family: sans-serif; padding: 20px;"><h2>¡Conexión Exitosa!</h2><p>El sistema de notificaciones está operando a nivel óptimo.</p></div>`
    }

    console.log(`[send-email] Sending ${type} email to ${to}`);

    const { data: emailData, error } = await resend.emails.send({
      from: 'Norvexis Core <noreply@norvexiscore.com>',
      to: typeof to === 'string' ? [to] : to,
      subject,
      html,
    });

    if (error) {
      console.error("[send-email] Error sending resend:", error);
      return new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error("[send-email] Exception:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
