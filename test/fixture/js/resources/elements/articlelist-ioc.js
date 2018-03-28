import { ArticleList } from "./articlelist";
import { DefaultInjector } from "../../../../../ioc/injector";
class $ArticleListActivator {
    instance;
    activate() {
        if (this.instance === undefined) {
            this.instance = new ArticleList();
        }
        return this.instance;
    }
}
DefaultInjector.addActivator(ArticleList, new $ArticleListActivator());
