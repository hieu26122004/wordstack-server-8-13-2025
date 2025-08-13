/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("users", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    username: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    avatar_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    google_id: {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    },
    is_admin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_login_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  });

  await queryInterface.sequelize.query(`
    ALTER TABLE "users"
    ADD CONSTRAINT check_google_id_password
    CHECK(
      (google_id IS NOT NULL) <> (password IS NOT NULL)
    );
  `);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
    ALTER TABLE "users"
    DROP CONSTRAINT IF EXISTS check_google_id_password;
  `);
  await queryInterface.dropTable("users");
}
