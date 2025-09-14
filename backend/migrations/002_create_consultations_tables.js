exports.up = function(knex) {
  return knex.schema
    .createTable('doctor_credentials', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('doctor_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('credential_type').notNullable(); // license, certificate, degree
      table.string('issuing_authority').notNullable();
      table.string('credential_number');
      table.date('issued_date');
      table.date('expiry_date');
      table.string('ipfs_hash'); // Document stored on IPFS
      table.string('ceramic_vc_id'); // Verifiable Credential on Ceramic
      table.enum('status', ['pending', 'verified', 'rejected']).defaultTo('pending');
      table.text('verification_notes');
      table.uuid('verified_by').references('id').inTable('users');
      table.timestamp('verified_at');
      table.timestamps(true, true);
      
      table.index('doctor_id');
      table.index('status');
      table.index('credential_type');
    })
    .createTable('consultations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('patient_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('doctor_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('type', ['ai', 'video', 'text']).notNullable();
      table.enum('status', ['scheduled', 'active', 'completed', 'cancelled']).defaultTo('scheduled');
      table.timestamp('scheduled_at');
      table.timestamp('started_at');
      table.timestamp('ended_at');
      table.integer('duration_minutes');
      table.text('notes');
      table.string('ceramic_record_id'); // Consultation record on Ceramic
      table.json('metadata');
      table.timestamps(true, true);
      
      table.index('patient_id');
      table.index('doctor_id');
      table.index('status');
      table.index('type');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('consultations')
    .dropTableIfExists('doctor_credentials');
};
