import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    })
  }

  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing user_id parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Fetch the user's name from profiles to personalize the calendar name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .limit(1)
      .single()

    const calendarName = profile?.full_name 
      ? `Workforce Schedule - ${profile.full_name}`
      : 'Workforce Schedule'

    // Fetch shifts ranging from 30 days in the past to 90 days in the future
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    const startDateStr = startDate.toISOString().split('T')[0]

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 90)
    const endDateStr = endDate.toISOString().split('T')[0]

    const { data: shifts, error: shiftsError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true })

    if (shiftsError) {
      console.error('Database error fetching shifts:', shiftsError)
      throw shiftsError
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HealthAxis//Workforce Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`,
      'X-WR-TIMEZONE:America/New_York',
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'X-LIC-LOCATION:America/New_York',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'TZNAME:EDT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]

    for (const shift of (shifts || [])) {
      const dtStamp = new Date(shift.updated_at || shift.created_at || new Date()).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      const dateNoDash = shift.date.replace(/-/g, '')
      const startTimeNoColon = shift.start_time.replace(/:/g, '') + '00'
      
      const [startHour, startMin] = shift.start_time.split(':').map(Number)
      const [endHour, endMin] = shift.end_time.split(':').map(Number)
      
      let endDateNoDash = dateNoDash
      if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
        // Night shift crosses midnight
        const d = new Date(shift.date + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        endDateNoDash = `${yyyy}${mm}${dd}`
      }
      
      const endTimeNoColon = shift.end_time.replace(/:/g, '') + '00'
      const summary = `Work Shift (${shift.start_time} - ${shift.end_time})`
      const description = shift.notes ? `Notes: ${shift.notes}` : 'Scheduled work shift.'
      
      icsContent.push('BEGIN:VEVENT')
      icsContent.push(`UID:shift-${shift.id}@healthaxis.com`)
      icsContent.push(`DTSTAMP:${dtStamp}`)
      icsContent.push(`DTSTART;TZID=America/New_York:${dateNoDash}T${startTimeNoColon}`)
      icsContent.push(`DTEND;TZID=America/New_York:${endDateNoDash}T${endTimeNoColon}`)
      icsContent.push(`SUMMARY:${summary}`)
      icsContent.push(`DESCRIPTION:${description}`)
      icsContent.push('END:VEVENT')
    }

    icsContent.push('END:VCALENDAR')

    return new Response(icsContent.join('\r\n'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="shift-schedule.ics"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    })

  } catch (error: any) {
    console.error('Calendar Feed Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})
