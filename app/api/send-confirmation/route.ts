import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, name, service, date, time, price } = await request.json();
    const ownerEmail = 'michaelcs1093@gmail.com';

    console.log(`Intentando enviar correo a: ${email}`);

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Si el destino es el mismo que el dueño, no usamos BCC para evitar errores de Resend en modo prueba
    const emailOptions: any = {
      from: 'Alcala Barber Drink <onboarding@resend.dev>',
      to: [email.trim().toLowerCase()],
      subject: '¡Nueva Cita! - Alcala Barber Drink',
      html: `
        <div style="font-family: sans-serif; background-color: #0c0c0c; color: #ffffff; padding: 40px; max-width: 600px; margin: auto; border: 1px solid #c9a84c;">
          <h1 style="color: #c9a84c; font-style: italic; border-bottom: 1px solid #262626; padding-bottom: 20px;">Alcala Barber Drink</h1>
          <p style="font-size: 18px;">Hola <strong>${name}</strong>,</p>
          <p style="color: #mid; line-height: 1.6;">Tu cita ha sido reservada con éxito. Aquí tienes los detalles:</p>
          
          <div style="background-color: #141414; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c9a84c;">
            <p style="margin: 5px 0;"><strong>Servicio:</strong> ${service}</p>
            <p style="margin: 5px 0;"><strong>Precio:</strong> $${price}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${date}</p>
            <p style="margin: 5px 0;"><strong>Hora:</strong> ${time}</p>
          </div>
          
          <p style="font-size: 14px; color: #888;">Si necesitas cancelar o cambiar tu cita, por favor contáctanos vía WhatsApp.</p>
          <p style="margin-top: 40px; font-size: 12px; color: #555; text-align: center;">© 2026 Alcala Barber Drink. Todos los derechos reservados.</p>
        </div>
      `,
    };

    // Solo añadir BCC si el correo de destino NO es el del dueño
    if (email.trim().toLowerCase() !== ownerEmail.toLowerCase()) {
      emailOptions.bcc = [ownerEmail];
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('Error de Resend:', error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
