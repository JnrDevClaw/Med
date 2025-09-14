exports.up = function(knex) {
  return knex.schema
    .createTable('users', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('did').unique().notNullable();
      table.string('name').notNullable();
      table.string('email');
      table.enum('role', ['patient', 'doctor']).notNullable();
      table.boolean('verified').defaultTo(false);
      table.json('metadata');
      table.timestamps(true, true);
      
      table.index('did');
      table.index('email');
      table.index('role');
    })
    .createTable('ceramic_profiles', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('did').notNullable();
      table.string('profile_stream_id');
      table.json('profile_data');
      table.timestamps(true, true);
      
      table.index('user_id');
      table.index('did');
    })
    .createTable('refresh_tokens', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.text('token').notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamps(true, true);
      
      table.index('user_id');
      table.index('token');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('refresh_tokens')
    .dropTableIfExists('ceramic_profiles')
    .dropTableIfExists('users');
};
