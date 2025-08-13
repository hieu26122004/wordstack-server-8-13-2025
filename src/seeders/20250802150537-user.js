/** @type {import('sequelize-cli').Migration} */
import { faker } from "@faker-js/faker";

export default {
  async up(queryInterface, Sequelize) {
    const users = Array.from({ length: 10 }).map(() => ({
      username: faker.internet.userName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      avatar_url: "https://thispersondoesnotexist.com/",
      google_id: null,
      is_admin: false,
      is_active: true,
      last_login_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    return queryInterface.bulkInsert("users", users);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete("users", null, {});
  },
};
