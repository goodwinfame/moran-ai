import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "@/stores/project-store";
import type { ProjectInfo } from "@/stores/project-store";

/**
 * Project store unit tests.
 */
describe("project-store", () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: null,
      projects: [],
    });
  });

  it("starts with null project and empty list", () => {
    const state = useProjectStore.getState();
    expect(state.currentProject).toBeNull();
    expect(state.projects).toEqual([]);
  });

  it("setProjects updates the project list", () => {
    const projects: ProjectInfo[] = [
      {
        id: "p1",
        name: "测试项目",
        genre: "玄幻",
        totalWords: 50000,
        chapterCount: 10,
        currentArc: 1,
        status: "planning",
      },
      {
        id: "p2",
        name: "第二个项目",
        genre: "都市",
        totalWords: 120000,
        chapterCount: 25,
        currentArc: 2,
        status: "active",
      },
    ];

    useProjectStore.getState().setProjects(projects);
    expect(useProjectStore.getState().projects).toHaveLength(2);
    expect(useProjectStore.getState().projects[0]?.name).toBe("测试项目");
  });

  it("setCurrentProject selects a project", () => {
    const project: ProjectInfo = {
      id: "p1",
      name: "测试项目",
      genre: "玄幻",
      totalWords: 50000,
      chapterCount: 10,
      currentArc: 1,
      status: "planning",
    };

    useProjectStore.getState().setCurrentProject(project);
    expect(useProjectStore.getState().currentProject?.id).toBe("p1");
  });

  it("setCurrentProject(null) deselects", () => {
    const project: ProjectInfo = {
      id: "p1",
      name: "测试",
      genre: "科幻",
      totalWords: 0,
      chapterCount: 0,
      currentArc: 0,
      status: "planning",
    };

    useProjectStore.getState().setCurrentProject(project);
    useProjectStore.getState().setCurrentProject(null);
    expect(useProjectStore.getState().currentProject).toBeNull();
  });
});
