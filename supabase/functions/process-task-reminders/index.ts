import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
type TaskRow = any;

interface UserProfile {
  user_id: string;
  full_name: string;
}

const getPriorityLabel = (priority: string): string => {
  const labels: Record<string, string> = {
    baixa: "🟢 Baixa",
    media: "🟡 Média",
    alta: "🟠 Alta",
    urgente: "🔴 Urgente",
  };
  return labels[priority] || priority;
};

const formatDateTime = (date: string, time: string | null): string => {
  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (time) {
    return `${formattedDate} às ${time.slice(0, 5)}`;
  }
  return formattedDate;
};

const generateEmailHtml = (
  task: TaskRow,
  userName: string
): string => {
  const companyName = task.companies?.name || "Não vinculada";
  const contactName = task.contacts
    ? `${task.contacts.first_name}${task.contacts.last_name ? " " + task.contacts.last_name : ""}`
    : "Não vinculado";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lembrete de Tarefa</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⏰ Lembrete de Tarefa</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Você tem uma tarefa próxima do prazo!</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
        Olá <strong>${userName}</strong>,
      </p>
      
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 25px 0;">
        Esta é uma lembrança de que você tem uma tarefa com prazo em aproximadamente <strong>1 hora</strong>.
      </p>
      
      <!-- Task Card -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; border-left: 4px solid #6366f1;">
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 15px 0;">
          📋 ${task.title}
        </h2>
        
        ${task.description ? `
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
          ${task.description}
        </p>
        ` : ""}
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px;">📅 Vencimento:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 500;">${formatDateTime(task.due_date, task.due_time)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">⚡ Prioridade:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 500;">${getPriorityLabel(task.priority)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">🏢 Empresa:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">👤 Contato:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${contactName}</td>
          </tr>
        </table>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 30px;">
        <a href="${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/tasks" 
           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Ver Minhas Tarefas
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Este é um email automático enviado pelo sistema de CRM.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Processing task reminders...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const resend = new Resend(resendApiKey);

    // Calculate time window: tasks due between now and 1 hour from now
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    console.log(`Checking tasks due between ${now.toISOString()} and ${oneHourFromNow.toISOString()}`);

    // Fetch tasks that:
    // - Are pending or in progress
    // - Have a due date
    // - Have an assigned user
    // - Due within the next hour
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        due_date,
        due_time,
        assigned_to,
        priority,
        company_id,
        contact_id,
        companies:company_id(name),
        contacts:contact_id(first_name, last_name)
      `)
      .in("status", ["pendente", "em_andamento"])
      .not("due_date", "is", null)
      .not("assigned_to", "is", null);

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} pending/in_progress tasks with due dates`);

    // Filter tasks that are due within the next hour
    const eligibleTasks = (tasks || []).filter((task: TaskRow) => {
      const taskDueDate = new Date(task.due_date);
      
      // If task has a specific time, use it
      if (task.due_time) {
        const [hours, minutes] = task.due_time.split(":").map(Number);
        taskDueDate.setHours(hours, minutes, 0, 0);
      } else {
        // Default to end of day if no time specified
        taskDueDate.setHours(23, 59, 59, 999);
      }

      // Check if task is due within the next hour
      return taskDueDate > now && taskDueDate <= oneHourFromNow;
    });

    console.log(`${eligibleTasks.length} tasks are due within the next hour`);

    if (eligibleTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No tasks need reminders", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which tasks already have reminders sent
    const taskIds = eligibleTasks.map((t: TaskRow) => t.id);
    const { data: existingReminders, error: remindersError } = await supabase
      .from("task_reminders")
      .select("task_id, user_id")
      .in("task_id", taskIds)
      .eq("reminder_type", "email_1h");

    if (remindersError) {
      console.error("Error fetching existing reminders:", remindersError);
      throw remindersError;
    }

    // Create a set of already reminded task-user combinations
    const remindedSet = new Set(
      (existingReminders || []).map((r) => `${r.task_id}-${r.user_id}`)
    );

    // Filter out tasks that already have reminders
    const tasksToRemind = eligibleTasks.filter(
      (task: TaskRow) => !remindedSet.has(`${task.id}-${task.assigned_to}`)
    );

    console.log(`${tasksToRemind.length} tasks need reminders (after filtering existing)`);

    if (tasksToRemind.length === 0) {
      return new Response(
        JSON.stringify({ message: "All eligible tasks already have reminders", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(tasksToRemind.map((t: TaskRow) => t.assigned_to))];

    // Fetch user emails from auth.users (requires service role)
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching users:", authError);
      throw authError;
    }

    // Create a map of user_id -> email
    const userEmailMap = new Map<string, string>();
    authData.users.forEach((user) => {
      if (user.email) {
        userEmailMap.set(user.id, user.email);
      }
    });

    // Fetch user profiles for names
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds as string[]);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Create a map of user_id -> full_name
    const userNameMap = new Map<string, string>();
    (profiles || []).forEach((profile: UserProfile) => {
      userNameMap.set(profile.user_id, profile.full_name);
    });

    // Send reminders
    let sentCount = 0;
    const errors: string[] = [];

    for (const task of tasksToRemind) {
      const userEmail = userEmailMap.get(task.assigned_to!);
      const userName = userNameMap.get(task.assigned_to!) || "Usuário";

      if (!userEmail) {
        console.warn(`No email found for user ${task.assigned_to}`);
        continue;
      }

      try {
        console.log(`Sending reminder for task "${task.title}" to ${userEmail}`);

        // Send email via Resend
        const emailResult = await resend.emails.send({
          from: "CRM <noreply@resend.dev>",
          to: [userEmail],
          subject: `⏰ Lembrete: Tarefa "${task.title}" vence em 1 hora`,
          html: generateEmailHtml(task, userName),
        });

        console.log("Email sent:", emailResult);

        // Record the reminder in the database
        const { error: insertError } = await supabase
          .from("task_reminders")
          .insert({
            task_id: task.id,
            user_id: task.assigned_to,
            reminder_type: "email_1h",
          });

        if (insertError) {
          console.error(`Error recording reminder for task ${task.id}:`, insertError);
          errors.push(`Failed to record reminder for task ${task.id}`);
        } else {
          sentCount++;
        }
      } catch (emailError) {
        console.error(`Error sending email for task ${task.id}:`, emailError);
        errors.push(`Failed to send email for task ${task.id}: ${emailError}`);
      }
    }

    console.log(`Finished processing. Sent ${sentCount} reminders.`);

    return new Response(
      JSON.stringify({
        message: `Processed ${tasksToRemind.length} tasks`,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-task-reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
