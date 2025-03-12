import { createClient } from 'npm:@supabase/supabase-js@2'
import { JWT } from 'npm:google-auth-library@9'
import serviceAccount from '../service-account.json' with { type: 'json' }

interface ChatMessage {
  id: string
  sender: string
  receiver: string
  message: string
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: ChatMessage
  schema: 'public'
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json()

  console.log(`sender: ${payload.record.sender}`)
  console.log(`receiver: ${payload.record.receiver}`)

  var { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.record.receiver)
    .single()

    const fcmToken = data!.fcm_token as string

  var { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.record.sender)
    .single()

  const sender_id = payload.record.sender
  const sender_name = data!.name as string
  
  const accessToken = await getAccessToken({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  })

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: {
            title: sender_name,
            body: payload.record.message,
          },
          android: {
            collapse_key: sender_id,
            notification: {
              channel_id: "message",
            },
          },
        },
      }),
    }
  )

  const resData = await res.json()
  if (res.status < 200 || 299 < res.status) {
    throw resData
  }

  return new Response(JSON.stringify(resData), {
    headers: { 'Content-Type': 'application/json' },
  })
})

const getAccessToken = ({
  clientEmail,
  privateKey,
}: {
  clientEmail: string
  privateKey: string
}): Promise<string> => {
  return new Promise((resolve, reject) => {
    const jwtClient = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    })
    jwtClient.authorize((err, tokens) => {
      if (err) {
        reject(err)
        return
      }
      resolve(tokens!.access_token!)
    })
  })
}