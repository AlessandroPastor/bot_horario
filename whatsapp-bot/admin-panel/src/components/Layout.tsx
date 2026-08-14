import { AppShell, Burger, Button, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBook2,
  IconCalendarEvent,
  IconLayoutDashboard,
  IconLogout,
  IconSchool,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLogout } from "../hooks/useSesion";

const ENLACES = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard },
  { to: "/docentes", label: "Docentes", icon: IconUsers },
  { to: "/cursos", label: "Cursos", icon: IconBook2 },
  { to: "/horarios", label: "Horarios", icon: IconSchool },
  { to: "/calendario", label: "Calendario cívico", icon: IconCalendarEvent },
  { to: "/reuniones", label: "Reuniones de padres", icon: IconUsersGroup },
];

export function Layout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconSchool size={22} />
            <Text fw={700} size="lg">
              Panel Ceneciano
            </Text>
          </Group>
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconLogout size={16} />}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login") })}
          >
            Salir
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        {ENLACES.map((enlace) => (
          <NavLink
            key={enlace.to}
            label={enlace.label}
            leftSection={<enlace.icon size={18} />}
            active={location.pathname === enlace.to}
            onClick={() => navigate(enlace.to)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
