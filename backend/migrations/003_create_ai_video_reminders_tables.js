exports.up = function(knex) {
  return knex.schema
    .createTable('ai_consultations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('consultation_id').references('id').inTable('consultations').onDelete('CASCADE');
      table.uuid('patient_id').references('id').inTable('users').onDelete('CASCADE');
      table.text('patient_message').notNullable();
      table.text('ai_response');
      table.string('model_used'); // e.g., 'biogpt', 'mistral-med'
      table.json('model_metadata');
      table.float('confidence_score');
      table.boolean('escalated').defaultTo(false);
      table.timestamps(true, true);
      
      table.index('consultation_id');
      table.index('patient_id');
      table.index('model_used');
    })
    .createTable('video_calls', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('consultation_id').references('id').inTable('consultations').onDelete('CASCADE');
      table.string('agora_channel_name').notNullable();
      table.string('agora_uid_patient');
      table.string('agora_uid_doctor');
      table.string('patient_token');
      table.string('doctor_token');
      table.timestamp('call_started_at');
      table.timestamp('call_ended_at');
      table.integer('call_duration_seconds');
      table.enum('call_status', ['waiting', 'connected', 'ended', 'failed']).defaultTo('waiting');
      table.json('call_metadata');
      table.timestamps(true, true);
      
      table.index('consultation_id');
      table.index('agora_channel_name');
      table.index('call_status');
    })
    .createTable('health_reminders', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('patient_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('title').notNullable();
      table.text('description');
      table.enum('type', ['medication', 'appointment', 'exercise', 'diet', 'custom']).notNullable();
      table.timestamp('reminder_time').notNullable();
      table.string('recurrence_pattern'); // daily, weekly, monthly, etc.
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_sent').defaultTo(false);
      table.timestamp('sent_at');
      table.json('metadata');
      table.timestamps(true, true);
      
      table.index('patient_id');
      table.index('reminder_time');
      table.index('is_active');
      table.index('type');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('health_reminders')
    .dropTableIfExists('video_calls')
    .dropTableIfExists('ai_consultations');
};
