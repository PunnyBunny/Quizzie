import React, { useEffect, useState } from "react";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { AddUserIcon, CloseIcon, SearchIcon } from "../components/icons";

interface User {
  email?: string;
  isAdmin: boolean;
}

interface AdminGetUsersResponse {
  users: User[];
}

interface AdminCreateUserInput {
  email: string;
}

interface AdminCreateUserOutput {
  uid: string;
  email: string;
  resetLink: string;
}

interface AdminResetPasswordInput {
  email: string;
}

interface AdminResetPasswordOutput {
  email: string;
  resetLink: string;
}

interface AdminRemoveUserInput {
  email: string;
}

interface AdminRemoveUserOutput {
  email: string;
}

const INPUT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm";

export default function AdminUserManagement() {
  const [getUsers, gettingUsers] = useCallable<{}, AdminGetUsersResponse>("api/admin/get-users");
  const [createUser, creatingUser] = useCallable<AdminCreateUserInput, AdminCreateUserOutput>(
    "api/admin/create-user",
  );
  const [resetPassword, resettingPassword] = useCallable<
    AdminResetPasswordInput,
    AdminResetPasswordOutput
  >("api/admin/reset-password");
  const [removeUser, removingUser] = useCallable<AdminRemoveUserInput, AdminRemoveUserOutput>(
    "api/admin/remove-user",
  );

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [formData, setFormData] = useState({ email: "" });
  const [createUserSuccess, setCreateUserSuccess] = useState(false);
  const [createUserErrorMsg, setCreateUserErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loadUsersError, setLoadUsersError] = useState<string | null>(null);
  const [resetLinkPopup, setResetLinkPopup] = useState<{
    email: string;
    resetLink: string;
    title: string;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getUsers()
      .then((response) => {
        setUsers(response.data.users);
        setLoadUsersError(null);
      })
      .catch((err) => {
        setLoadUsersError(toUserMessage(err, "Could not load users."));
      });
  }, [getUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserSuccess(false);
    setCreateUserErrorMsg(null);

    try {
      const result = await createUser({ email: formData.email });
      setResetLinkPopup({
        email: result.data.email,
        resetLink: result.data.resetLink,
        title: "User Created Successfully",
        message: `User ${result.data.email} has been created. Share the password reset link below with the user so they can set their password.`,
      });

      setFormData({ email: "" });
      setCreateUserSuccess(true);
      setTimeout(() => setCreateUserSuccess(false), 3000);

      const response = await getUsers();
      setUsers(response.data.users);
    } catch (error) {
      console.error("Failed to create user:", error);
      setCreateUserErrorMsg(toUserMessage(error, "Could not create user."));
    }
  };

  const handleCopyLink = async () => {
    if (resetLinkPopup?.resetLink) {
      await navigator.clipboard.writeText(resetLinkPopup.resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closePopup = () => {
    setResetLinkPopup(null);
    setCopied(false);
  };

  const handleResetPassword = async (email: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await resetPassword({ email });
      setResetLinkPopup({
        email: result.data.email,
        resetLink: result.data.resetLink,
        title: "Password Reset Link Generated",
        message: `A password reset link has been generated for ${result.data.email}. Share this link with the user so they can reset their password.`,
      });
    } catch (error) {
      console.error("Failed to reset password:", error);
      setActionError(toUserMessage(error, "Could not generate a reset link."));
    }
  };

  const handleRemoveUser = async (email: string) => {
    const confirmed = confirm(
      `Are you sure you want to remove ${email}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await removeUser({ email });
      setActionSuccess(`User ${result.data.email} has been removed.`);
      setTimeout(() => setActionSuccess(null), 4000);

      const response = await getUsers();
      setUsers(response.data.users);
    } catch (error) {
      console.error("Failed to remove user:", error);
      setActionError(toUserMessage(error, "Could not remove user."));
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-4 sm:p-6">
      {resetLinkPopup && (
        <Modal onClose={closePopup} maxWidth="lg">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{resetLinkPopup.title}</h3>
            <button
              type="button"
              onClick={closePopup}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <p className="text-gray-600 mb-4">{resetLinkPopup.message}</p>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password Reset Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={resetLinkPopup.resetLink}
                className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2 text-gray-700"
              />
              <Button variant={copied ? "success" : "primary"} onClick={handleCopyLink}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={closePopup}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="User Management"
          subtitle="Manage platform users, roles, and permissions"
          backTo="/admin"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Create User Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-6 lg:sticky lg:top-20">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AddUserIcon className="w-5 h-5 text-green-600" />
                Add New User
              </h3>

              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ email: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="user@example.com"
                    required
                  />
                </div>

                {createUserErrorMsg && <Alert kind="error">{createUserErrorMsg}</Alert>}

                {createUserSuccess && <Alert kind="success">User created successfully!</Alert>}

                <Button
                  type="submit"
                  variant="success"
                  disabled={creatingUser}
                  className="w-full"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </Button>
              </form>
            </div>
          </div>

          {/* User List */}
          <div className="lg:col-span-2 space-y-3">
            {actionError && <Alert kind="error">{actionError}</Alert>}
            {actionSuccess && <Alert kind="success">{actionSuccess}</Alert>}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <h3 className="font-semibold text-gray-900">System Users</h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-auto pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="absolute left-2.5 top-2 text-gray-400">
                    <SearchIcon />
                  </div>
                </div>
              </div>

              {/* Mobile: stacked card list */}
              <div className="sm:hidden divide-y divide-gray-200">
                {gettingUsers && (
                  <div className="px-4 py-8 text-center text-gray-500">Loading users...</div>
                )}
                {loadUsersError && (
                  <div className="px-4 py-8 text-center text-red-600">{loadUsersError}</div>
                )}
                {!gettingUsers &&
                  !loadUsersError &&
                  (filteredUsers.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      {users.length === 0 ? "No users found" : "No users match your search"}
                    </div>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <div key={index} className="px-4 py-3 flex flex-col gap-2">
                        <div className="font-medium text-gray-900 break-all">{user.email}</div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.isAdmin
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.isAdmin ? "Admin" : "User"}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </div>
                        {!user.isAdmin && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => user.email && handleResetPassword(user.email)}
                              disabled={resettingPassword || !user.email}
                            >
                              Reset Pwd
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => user.email && handleRemoveUser(user.email)}
                              disabled={removingUser || !user.email}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ))}
              </div>

              {/* sm+: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 font-medium">User</th>
                      <th className="px-4 sm:px-6 py-3 font-medium">Role</th>
                      <th className="px-4 sm:px-6 py-3 font-medium">Status</th>
                      <th className="px-4 sm:px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {gettingUsers && (
                      <tr>
                        <td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                          Loading users...
                        </td>
                      </tr>
                    )}
                    {loadUsersError && (
                      <tr>
                        <td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-red-600">
                          {loadUsersError}
                        </td>
                      </tr>
                    )}
                    {!gettingUsers &&
                      !loadUsersError &&
                      (filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                            {users.length === 0 ? "No users found" : "No users match your search"}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => (
                          <tr key={index}>
                            <td className="px-4 sm:px-6 py-3 font-medium text-gray-900 whitespace-nowrap">
                              {user.email}
                            </td>
                            <td className="px-4 sm:px-6 py-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.isAdmin
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {user.isAdmin ? "Admin" : "User"}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3 whitespace-nowrap space-x-2">
                              {user.isAdmin ? (
                                "N/A"
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => user.email && handleResetPassword(user.email)}
                                    disabled={resettingPassword || !user.email}
                                  >
                                    Reset Pwd
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => user.email && handleRemoveUser(user.email)}
                                    disabled={removingUser || !user.email}
                                  >
                                    Remove
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
