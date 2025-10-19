
exports.up = function(knex) {
  return knex.schema.createTable('answers', table => {
    table.increments('id').primary();
    table.integer('question_id').unsigned().notNullable().references('id').inTable('questions').onDelete('CASCADE');
    table.integer('doctor_id').unsigned().notNullable().references('id').inTable('users');
    table.text('body').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('answers');
};
