
exports.up = function(knex) {
  return knex.schema.createTable('questions', table => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().references('id').inTable('users');
    table.integer('doctor_id').unsigned().references('id').inTable('users');
    table.string('title').notNullable();
    table.text('body').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('questions');
};
