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

    // Fetch timezone dynamically based on user location assignment
    let timezone = 'America/New_York'
    try {
      const { data: assignment } = await supabaseAdmin
        .from('user_location_assignments')
        .select('location_id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()

      const targetLocationId = assignment?.location_id
      if (targetLocationId) {
        const { data: loc } = await supabaseAdmin
          .from('clinic_locations')
          .select('timezone')
          .eq('id', targetLocationId)
          .limit(1)
          .maybeSingle()
        if (loc?.timezone) {
          timezone = loc.timezone
        }
      } else {
        // Fallback to first available clinic location timezone
        const { data: loc } = await supabaseAdmin
          .from('clinic_locations')
          .select('timezone')
          .limit(1)
          .maybeSingle()
        if (loc?.timezone) {
          timezone = loc.timezone
        }
      }
    } catch (tzErr) {
      console.error('Failed to resolve timezone, defaulting to America/New_York:', tzErr)
    }

    // Helper to generate VTIMEZONE block for common US timezones
    const getTimezoneComponent = (tz: string): string[] => {
      let stdOffset = '-0500'
      let dstOffset = '-0400'
      let hasDst = true
      let stdName = 'EST'
      let dstName = 'EDT'
      
      if (tz === 'America/Chicago') {
        stdOffset = '-0600'
        dstOffset = '-0500'
        stdName = 'CST'
        dstName = 'CDT'
      } else if (tz === 'America/Denver') {
        stdOffset = '-0700'
        dstOffset = '-0600'
        stdName = 'MST'
        dstName = 'MDT'
      } else if (tz === 'America/Los_Angeles') {
        stdOffset = '-0800'
        dstOffset = '-0700'
        stdName = 'PST'
        dstName = 'PDT'
      } else if (tz === 'America/Phoenix') {
        stdOffset = '-0700'
        dstOffset = '-0700'
        stdName = 'MST'
        hasDst = false
      }
      
      const rules = [
        'BEGIN:VTIMEZONE',
        `TZID:${tz}`,
        `X-LIC-LOCATION:${tz}`,
      ]
      
      if (hasDst) {
        rules.push(
          'BEGIN:DAYLIGHT',
          `TZOFFSETFROM:${stdOffset}`,
          `TZOFFSETTO:${dstOffset}`,
          `TZNAME:${dstName}`,
          'DTSTART:19700308T020000',
          'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
          'END:DAYLIGHT',
          'BEGIN:STANDARD',
          `TZOFFSETFROM:${dstOffset}`,
          `TZOFFSETTO:${stdOffset}`,
          `TZNAME:${stdName}`,
          'DTSTART:19701101T020000',
          'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
          'END:STANDARD'
        )
      } else {
        rules.push(
          'BEGIN:STANDARD',
          `TZOFFSETFROM:${stdOffset}`,
          `TZOFFSETTO:${stdOffset}`,
          `TZNAME:${stdName}`,
          'DTSTART:19700101T000000',
          'END:STANDARD'
        )
      }
      
      rules.push('END:VTIMEZONE')
      return rules
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HealthAxis//Workforce Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`,
      `X-WR-TIMEZONE:${timezone}`,
      ...getTimezoneComponent(timezone)
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
      icsContent.push(`DTSTART;TZID=${timezone}:${dateNoDash}T${startTimeNoColon}`)
      icsContent.push(`DTEND;TZID=${timezone}:${endDateNoDash}T${endTimeNoColon}`)
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
